/**
 * User panel logic for the Esports Tournament app. This module wires up
 * event handlers, listens for realtime updates from Firebase, and
 * manages optimistic UI updates. It handles profile setup, home page
 * sliders, category filters, tournament listing and joining, wallet
 * information, and basic withdrawal requests. All interactions are
 * designed to work offline-friendly by relying on Firebase's local
 * cache and realtime listeners.
 */

// Wait for DOM ready before initializing the user app.
document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI helpers (toast etc.).
  UI.init();
  // Sign in anonymously and then initialize the app.
  Auth.signInAnon().then(() => {
    const user = firebase.auth().currentUser;
    initUserApp(user);
  }).catch((err) => {
    console.error(err);
    UI.showToast('Unable to sign in. Please refresh.');
  });
});

/**
 * Initializes the user panel once the user is signed in. This sets up
 * navigation, loads initial data, and attaches realtime listeners.
 *
 * @param {firebase.User} user The currently signed-in Firebase user.
 */
function initUserApp(user) {
  // Set up bottom navigation switching.
  const navButtons = document.querySelectorAll('.bottom-nav button');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.getAttribute('data-target');
      document.querySelectorAll('.page').forEach(pg => {
        pg.classList.remove('active');
      });
      document.getElementById(target).classList.add('active');
      // update title in app bar
      document.getElementById('app-title').textContent = btn.dataset.title;
    });
  });
  // Activate home by default
  document.querySelector('.bottom-nav button[data-target="homePage"]').click();

  // Load user profile and show setup modal if needed.
  loadUserProfile(user);
  // Load home page data: slider, categories, upcoming card.
  loadSlider();
  loadCategories();
  loadUpcoming();
  // Load tournaments list.
  loadTournaments();
  // Load wallet info.
  loadWallet(user.uid);
  loadWalletHistory(user.uid);
}

/**
 * Loads the signed-in user's profile. If the profile doesn't exist
 * (first run), prompts the user to complete setup via a modal. The
 * profile is kept in sync with the database in realtime.
 *
 * @param {firebase.User} user
 */
function loadUserProfile(user) {
  const profileRef = db.ref('users/' + user.uid);
  profileRef.on('value', (snap) => {
    const data = snap.val();
    if (!data) {
      // Show profile setup modal on first run
      UI.showModal('profileSetupModal');
    } else {
      // Hide modal if open and update displayed name
      UI.closeModal('profileSetupModal');
      document.getElementById('userNameDisplay').textContent = data.name || 'User';
    }
  });
}

/**
 * Saves the user profile information entered in the setup modal. It
 * creates or overwrites the `/users/{uid}` node with the provided
 * details and initializes wallet and stats if they don't exist.
 */
function saveUserProfile() {
  const name = document.getElementById('setupName').value.trim();
  const phone = document.getElementById('setupPhone').value.trim();
  const ign = document.getElementById('setupIgn').value.trim();
  if (!name || !phone) {
    UI.showToast('Please fill all fields.');
    return;
  }
  const uid = firebase.auth().currentUser.uid;
  const ref = db.ref('users/' + uid);
  ref.set({
    name: name,
    phone: phone,
    createdAt: Date.now(),
    isBlocked: false,
    gameProfiles: {
      ign: ign
    },
    wallet: {
      balance: 0,
      totalEarned: 0,
      totalWithdrawn: 0
    },
    stats: {
      matches: 0,
      wins: 0,
      points: 0
    }
  }).then(() => {
    UI.closeModal('profileSetupModal');
    UI.showToast('Profile saved!');
  }).catch((err) => {
    console.error(err);
    UI.showToast('Error saving profile.');
  });
}

/**
 * Loads and renders the news slider from the `/newsSlider` node. The
 * slides are ordered by the `order` property and only enabled
 * entries are shown. Each slide can link to a URL or tournament.
 */
function loadSlider() {
  const container = document.getElementById('sliderContainer');
  container.innerHTML = '';
  db.ref('newsSlider').orderByChild('order').on('value', (snap) => {
    const slides = [];
    snap.forEach(child => {
      const slide = child.val();
      if (slide.enabled) {
        slides.push(slide);
      }
    });
    renderSlider(slides);
  });
}

/**
 * Renders an array of slides into the slider container. Handles
 * autoplay by toggling slide visibility on an interval. When a slide
 * is clicked, the appropriate action is performed based on its
 * `linkType` field.
 *
 * @param {Array<Object>} slides
 */
function renderSlider(slides) {
  const container = document.getElementById('sliderContainer');
  container.innerHTML = '';
  slides.forEach((slide) => {
    const div = document.createElement('div');
    div.className = 'slide';
    div.style.backgroundImage = `url(${slide.imageUrl})`;
    div.innerHTML = `<div class="slide-content"><h3>${slide.title}</h3></div>`;
    div.addEventListener('click', () => {
      handleSlideClick(slide);
    });
    container.appendChild(div);
  });
  startAutoPlay();
}

let sliderInterval;

/**
 * Starts the slider autoplay logic. Only one slide is visible at a
 * time and the slides cycle every four seconds. Previous intervals
 * are cleared before starting a new one.
 */
function startAutoPlay() {
  clearInterval(sliderInterval);
  const slides = document.querySelectorAll('#sliderContainer .slide');
  if (slides.length === 0) return;
  let active = 0;
  slides.forEach((s, i) => {
    s.style.display = i === 0 ? 'block' : 'none';
  });
  sliderInterval = setInterval(() => {
    slides[active].style.display = 'none';
    active = (active + 1) % slides.length;
    slides[active].style.display = 'block';
  }, 4000);
}

/**
 * Handles click actions on a slider slide. If the slide links to a
 * URL, it opens the link in a new tab. If it links to a tournament,
 * it navigates to the tournament page and optionally focuses that
 * tournament.
 *
 * @param {Object} slide
 */
function handleSlideClick(slide) {
  if (slide.linkType === 'url') {
    window.open(slide.linkValue, '_blank');
  } else if (slide.linkType === 'tournament') {
    document.querySelector('.bottom-nav button[data-target="tournamentsPage"]').click();
    // Additional logic to focus on a tournament could go here
  }
}

/**
 * Loads categories from the `/categories` path and renders them as
 * clickable chips. Only enabled categories are shown. When a chip
 * is clicked, the tournaments list is filtered by that category.
 */
function loadCategories() {
  const catContainer = document.getElementById('categoriesContainer');
  db.ref('categories').orderByChild('order').on('value', (snap) => {
    catContainer.innerHTML = '';
    snap.forEach(child => {
      const cat = child.val();
      if (!cat.enabled) return;
      const btn = document.createElement('button');
      btn.className = 'category-chip';
      btn.textContent = cat.name;
      btn.addEventListener('click', () => {
        filterByCategory(child.key);
      });
      catContainer.appendChild(btn);
    });
  });
}

/**
 * Stores the current filter state for tournaments. Category and search
 * are the two supported filters. When these values change, call
 * refreshTournamentList() to apply the filters.
 */
const currentFilters = {
  category: null,
  search: ''
};

/**
 * Applies a category filter to the tournaments list and refreshes
 * the view. Passing null clears the filter.
 *
 * @param {string|null} catId
 */
function filterByCategory(catId) {
  currentFilters.category = catId;
  refreshTournamentList();
}

/**
 * Loads the upcoming notification from `/homeUpcoming` and displays
 * it if enabled. Clicking the button navigates to tournaments page.
 */
function loadUpcoming() {
  db.ref('homeUpcoming').on('value', (snap) => {
    const data = snap.val();
    const card = document.getElementById('upcomingCard');
    if (data && data.enabled) {
      card.querySelector('h3').textContent = data.title;
      card.querySelector('p').textContent = data.subtitle || '';
      card.querySelector('button').onclick = () => {
        document.querySelector('.bottom-nav button[data-target="tournamentsPage"]').click();
      };
      card.style.display = 'block';
    } else {
      card.style.display = 'none';
    }
  });
}

/**
 * Loads the list of tournaments and listens for realtime changes.
 * Each tournament is rendered as a card with basic info and a join
 * button. Filtering and search are applied via refreshTournamentList().
 */
function loadTournaments() {
  const list = document.getElementById('tournamentsList');
  db.ref('tournaments').on('value', (snap) => {
    // Store tournaments in memory and render only those matching filters
    tournamentsCache = [];
    snap.forEach(child => {
      const t = child.val();
      tournamentsCache.push({ id: child.key, data: t });
    });
    refreshTournamentList();
  });
}

// In-memory cache of tournaments to facilitate filtering without hitting Firebase repeatedly.
let tournamentsCache = [];

/**
 * Renders the tournaments list based on cached data and current filters.
 */
function refreshTournamentList() {
  const list = document.getElementById('tournamentsList');
  list.innerHTML = '';
  tournamentsCache.forEach(({ id, data }) => {
    if (currentFilters.category && data.categoryId !== currentFilters.category) return;
    if (currentFilters.search && !data.title.toLowerCase().includes(currentFilters.search.toLowerCase())) return;
    renderTournamentCard(id, data);
  });
}

/**
 * Renders a single tournament card with join functionality. The join
 * button triggers a transaction that checks for slot availability,
 * user block status, wallet balance, and other constraints before
 * deducting the entry fee and adding the user to the tournament.
 *
 * @param {string} tId
 * @param {Object} t
 */
function renderTournamentCard(tId, t) {
  const list = document.getElementById('tournamentsList');
  const card = document.createElement('div');
  card.className = 'card tournament-card';
  card.innerHTML = `
    <h3>${t.title}</h3>
    <p>${t.gameName} • Fee: ₹${t.entryFee}</p>
    <p>${(t.joinedCount || 0)}/${t.maxSlots} joined</p>
    <button class="primary join-btn">Join</button>
  `;
  card.querySelector('.join-btn').addEventListener('click', () => {
    joinTournament(tId, t);
  });
  list.appendChild(card);
}

/**
 * Handles joining a tournament using Firebase transactions to prevent
 * race conditions. It first checks whether the user is blocked and
 * has sufficient wallet balance. If checks pass, it increments the
 * `joinedCount` atomically and deducts the entry fee from the user's
 * wallet in separate transactions. The user is then recorded in
 * `/tournamentJoins/{tId}/{uid}`.
 *
 * @param {string} tId
 * @param {Object} t
 */
function joinTournament(tId, t) {
  const uid = firebase.auth().currentUser.uid;
  // Retrieve user data to perform checks before starting transactions
  db.ref('users/' + uid).once('value').then((snapshot) => {
    const userData = snapshot.val();
    if (!userData) {
      UI.showToast('Profile not set up.');
      return;
    }
    if (userData.isBlocked) {
      UI.showToast('You are blocked.');
      return;
    }
    const balance = userData.wallet?.balance || 0;
    if (balance < t.entryFee) {
      UI.showToast('Insufficient wallet balance.');
      return;
    }
    // First transaction: update joinedCount atomically
    const tournamentRef = db.ref('tournaments/' + tId);
    tournamentRef.transaction((curr) => {
      if (curr) {
        // Abort if slots are full or tournament not joinable
        if (curr.joinedCount >= curr.maxSlots) {
          return; // abort the transaction
        }
        curr.joinedCount = (curr.joinedCount || 0) + 1;
      }
      return curr;
    }, (error, committed) => {
      if (error) {
        console.error(error);
        UI.showToast('Error joining tournament.');
      } else if (!committed) {
        UI.showToast('Slots are full.');
      } else {
        // Second transaction: deduct fee from wallet
        const walletRef = db.ref('users/' + uid + '/wallet/balance');
        walletRef.transaction((bal) => {
          if ((bal || 0) >= t.entryFee) {
            return (bal || 0) - t.entryFee;
          }
          return; // abort
        }, (err, committed2) => {
          if (err || !committed2) {
            // Failed to deduct fee: revert joinedCount by decrementing once
            tournamentRef.child('joinedCount').transaction((c) => {
              return (c || 1) - 1;
            });
            UI.showToast('Unable to deduct fee.');
          } else {
            // Record the join under tournamentJoins
            const joinPath = db.ref('tournamentJoins/' + tId + '/' + uid);
            joinPath.set({
              uid: uid,
              userName: userData.name,
              gameUidOrIgn: userData.gameProfiles?.ign || '',
              phone: userData.phone,
              joinedAt: Date.now(),
              status: 'joined'
            });
            UI.showToast('Joined successfully!');
          }
        });
      }
    });
  });
}

/**
 * Listens for changes to the user's wallet balance and updates the UI
 * accordingly. Displays ₹0 if no wallet exists yet.
 *
 * @param {string} uid
 */
function loadWallet(uid) {
  const balanceEl = document.getElementById('walletBalance');
  db.ref('users/' + uid + '/wallet/balance').on('value', (snap) => {
    const bal = snap.val() || 0;
    balanceEl.textContent = '₹' + bal;
  });
}

/**
 * Loads the most recent 20 wallet transactions for the user and
 * displays them in the wallet history section. Each entry shows the
 * type, amount, and date. Newest items appear first.
 *
 * @param {string} uid
 */
function loadWalletHistory(uid) {
  const list = document.getElementById('walletHistory');
  db.ref('walletHistory/' + uid).limitToLast(20).on('value', (snap) => {
    list.innerHTML = '';
    const items = [];
    snap.forEach(child => {
      items.push(child.val());
    });
    // Reverse order so the latest transaction appears on top
    items.reverse();
    items.forEach((tx) => {
      const item = document.createElement('div');
      item.className = 'card';
      item.innerHTML = `
        <p><strong>${tx.type}</strong>: ₹${tx.amount}</p>
        <p>${new Date(tx.createdAt).toLocaleString()}</p>
        <p>${tx.note || ''}</p>
      `;
      list.appendChild(item);
    });
  });
}

/**
 * Handles withdrawal requests. Validates against minimum withdrawal
 * settings and deducts the requested amount (plus fee) from the user's
 * wallet using a transaction. Creates a record in `/withdrawals`
 * describing the request.
 */
function requestWithdrawal() {
  const amount = parseFloat(document.getElementById('withdrawAmount').value);
  const method = document.getElementById('withdrawMethod').value || 'upi';
  const account = document.getElementById('withdrawAccount').value || '';
  if (!amount || amount <= 0) {
    UI.showToast('Enter valid amount.');
    return;
  }
  // Fetch global app settings for withdrawal constraints
  db.ref('appSettings').once('value').then((snap) => {
    const settings = snap.val() || {};
    const min = settings.minWithdraw || 0;
    const feePercent = settings.withdrawFeePercent || 0;
    if (amount < min) {
      UI.showToast('Minimum withdraw is ₹' + min);
      return;
    }
    const fee = Math.ceil(amount * feePercent / 100);
    const uid = firebase.auth().currentUser.uid;
    // Deduct the amount from wallet in a transaction
    db.ref('users/' + uid + '/wallet/balance').transaction((bal) => {
      if ((bal || 0) >= amount) {
        return (bal || 0) - amount;
      }
      return; // abort
    }, (err, committed, snapBal) => {
      if (err || !committed) {
        UI.showToast('Insufficient balance.');
      } else {
        // Create a withdrawal record
        const ref = db.ref('withdrawals').push();
        ref.set({
          uid: uid,
          name: '',
          method: method,
          accountInfo: account,
          amount: amount,
          fee: fee,
          status: 'pending',
          adminNote: '',
          transactionId: '',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        // Clear form
        document.getElementById('withdrawAmount').value = '';
        document.getElementById('withdrawMethod').value = '';
        document.getElementById('withdrawAccount').value = '';
        UI.showToast('Withdraw requested.');
      }
    });
  });
}