/**
 * Admin panel logic for the Esports Tournament app. This module
 * handles authentication via email/password, verifies admin
 * privileges, wires up navigation between admin sections, and
 * implements realtime listeners for dashboard metrics, tournaments,
 * withdrawals, users, and app settings. Mutative actions (like
 * updating settings) write back to the database. Other management
 * features such as publishing results and exporting participants
 * should be added similarly.
 */

// Wait for the DOM to initialize before wiring up event handlers.
document.addEventListener('DOMContentLoaded', () => {
  UI.init();
  const loginForm = document.getElementById('adminLoginForm');
  // Handle login form submission
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = loginForm.email.value;
    const password = loginForm.password.value;
    Auth.signInWithEmail(email, password).then((cred) => {
      checkAdminPriv(cred.user);
    }).catch((err) => {
      console.error(err);
      UI.showToast('Login failed.');
    });
  });
  // Listen to auth state changes to support persistent login on refresh
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      checkAdminPriv(user);
    } else {
      showLogin();
    }
  });
});

/**
 * Shows the admin login form and hides the rest of the admin UI. Called
 * when the user is not authenticated or has been logged out.
 */
function showLogin() {
  document.getElementById('adminLoginPage').style.display = 'block';
  document.getElementById('adminApp').style.display = 'none';
  document.getElementById('adminTitle').textContent = 'Login';
}

/**
 * Shows the admin application and hides the login form. Called after
 * the admin's UID has been verified.
 */
function showAdminApp() {
  document.getElementById('adminLoginPage').style.display = 'none';
  document.getElementById('adminApp').style.display = 'block';
  document.getElementById('adminTitle').textContent = 'Dashboard';
  initAdminApp();
}

/**
 * Verifies whether the authenticated user has administrative
 * privileges. Admin UIDs are stored at `/adminUids/{uid} = true`.
 * If verified, the admin panel is shown; otherwise, the user is
 * logged out and an error is displayed.
 *
 * @param {firebase.User} user
 */
function checkAdminPriv(user) {
  if (!user) return;
  db.ref('adminUids/' + user.uid).once('value').then((snap) => {
    if (snap.val() === true) {
      showAdminApp();
    } else {
      Auth.signOut().then(() => {
        UI.showToast('Not authorized as admin.');
        showLogin();
      });
    }
  });
}

/**
 * Initializes admin functionality: sets up navigation, loads
 * dashboard metrics, tournaments, withdrawals, users, and app
 * settings. This function is called once after verifying admin
 * privileges.
 */
function initAdminApp() {
  // Set up admin navigation switching
  const navBtns = document.querySelectorAll('.admin-nav button');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.target;
      document.querySelectorAll('.admin-page').forEach(pg => {
        pg.classList.remove('active');
      });
      document.getElementById(target).classList.add('active');
      document.getElementById('adminTitle').textContent = btn.dataset.title;
    });
  });
  // Select first nav item by default
  document.querySelector('.admin-nav button').click();
  // Load dashboard metrics
  loadDashboard();
  // Load lists
  loadAdminTournaments();
  loadWithdrawals();
  loadUsersList();
  loadAppSettings();
}

/**
 * Loads dashboard metrics such as total users, active tournaments,
 * and pending withdrawals. Values are listened to in realtime.
 */
function loadDashboard() {
  const usersCountEl = document.getElementById('dashUsersCount');
  const activeTournEl = document.getElementById('dashActiveTournaments');
  const pendingWithdrawsEl = document.getElementById('dashPendingWithdrawals');
  // Total users
  db.ref('users').on('value', snap => {
    usersCountEl.textContent = snap.numChildren();
  });
  // Active tournaments
  db.ref('tournaments').orderByChild('status').equalTo('active').on('value', snap => {
    activeTournEl.textContent = snap.numChildren();
  });
  // Pending withdrawals
  db.ref('withdrawals').orderByChild('status').equalTo('pending').on('value', snap => {
    pendingWithdrawsEl.textContent = snap.numChildren();
  });
}

/**
 * Loads all tournaments for management. Each tournament card includes
 * buttons for editing or publishing results. Implement further
 * management features as needed.
 */
function loadAdminTournaments() {
  const list = document.getElementById('adminTournamentsList');
  db.ref('tournaments').on('value', snap => {
    list.innerHTML = '';
    snap.forEach(child => {
      const t = child.val();
      const item = document.createElement('div');
      item.className = 'card';
      item.innerHTML = `
        <h3>${t.title}</h3>
        <p>${t.gameName} • ${t.type} • ${t.status}</p>
        <button class="primary" data-action="edit">Edit</button>
        <button class="success" data-action="results">Publish Results</button>
      `;
      // Additional listeners could be added here
      list.appendChild(item);
    });
  });
}

/**
 * Loads all withdrawals for admin review. Each withdrawal card
 * displays the requesting user and amount. Approve and reject buttons
 * are placeholders and should be implemented with transactional
 * updates to the wallet and withdrawal status.
 */
function loadWithdrawals() {
  const list = document.getElementById('adminWithdrawalsList');
  db.ref('withdrawals').on('value', snap => {
    list.innerHTML = '';
    snap.forEach(child => {
      const w = child.val();
      const item = document.createElement('div');
      item.className = 'card';
      item.innerHTML = `
        <p>${w.name || w.uid} requests ₹${w.amount} (fee: ₹${w.fee})</p>
        <p>Status: ${w.status}</p>
        <button class="success" data-action="approve">Approve</button>
        <button class="danger" data-action="reject">Reject</button>
      `;
      list.appendChild(item);
    });
  });
}

/**
 * Loads all users for admin management. Each user card includes the
 * user's name and current wallet balance, with a button to block or
 * unblock. Blocking updates the `isBlocked` flag in the database.
 */
function loadUsersList() {
  const list = document.getElementById('adminUsersList');
  db.ref('users').on('value', snap => {
    list.innerHTML = '';
    snap.forEach(child => {
      const u = child.val();
      const li = document.createElement('div');
      li.className = 'card';
      li.innerHTML = `
        <p>${u.name || 'Unnamed'} (${child.key})</p>
        <p>Balance: ₹${u.wallet?.balance || 0}</p>
        <button class="${u.isBlocked ? 'success' : 'danger'}" data-action="${u.isBlocked ? 'unblock' : 'block'}">${u.isBlocked ? 'Unblock' : 'Block'}</button>
      `;
      // Block/unblock logic
      li.querySelector('button').addEventListener('click', () => {
        const newStatus = !u.isBlocked;
        db.ref('users/' + child.key + '/isBlocked').set(newStatus);
        UI.showToast(newStatus ? 'User blocked.' : 'User unblocked.');
      });
      list.appendChild(li);
    });
  });
}

/**
 * Loads the global app settings into the admin settings form and
 * listens for changes to update the database. When the form is
 * submitted, values are parsed and saved to `/appSettings`.
 */
function loadAppSettings() {
  const form = document.getElementById('settingsForm');
  db.ref('appSettings').on('value', snap => {
    const settings = snap.val() || {};
    form.minWithdraw.value = settings.minWithdraw || '';
    form.withdrawFeePercent.value = settings.withdrawFeePercent || '';
    form.maintenanceMode.checked = settings.maintenanceMode || false;
    form.joinCooldownSec.value = settings.joinCooldownSec || '';
    form.supportAutoMsg.value = settings.supportAutoMsg || '';
  });
  // Ensure we don't attach multiple submit handlers
  form.onsubmit = (e) => {
    e.preventDefault();
    const payload = {
      minWithdraw: parseInt(form.minWithdraw.value) || 0,
      withdrawFeePercent: parseInt(form.withdrawFeePercent.value) || 0,
      maintenanceMode: form.maintenanceMode.checked,
      joinCooldownSec: parseInt(form.joinCooldownSec.value) || 0,
      supportAutoMsg: form.supportAutoMsg.value || ''
    };
    db.ref('appSettings').set(payload).then(() => {
      UI.showToast('Settings updated.');
    });
  };
}