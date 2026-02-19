/**
 * UI helper module to centralize interactive components such as toast
 * notifications, bottom sheets, and modal overlays. By isolating these
 * routines into a single file, both user and admin panels can share
 * the same logic, reducing duplicate code and making future changes
 * easier to implement.
 */

const UI = (() => {
  let toastEl;
  /**
   * Initializes UI helpers by caching DOM references. Should be called
   * once after the DOM content has been loaded. Without calling init(),
   * other functions may silently fail if elements are missing.
   */
  function init() {
    toastEl = document.getElementById('toast');
  }

  /**
   * Displays a transient toast message to the user. The toast fades
   * in and out automatically and does not interrupt user flow. Only
   * one toast is visible at a time.
   *
   * @param {string} message The message to display.
   * @param {number} duration Duration in milliseconds before the toast hides.
   */
  function showToast(message, duration = 3000) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    setTimeout(() => {
      toastEl.classList.remove('show');
    }, duration);
  }

  /**
   * Opens a bottom sheet by ID. The sheet must exist in the DOM and
   * have the `.bottom-sheet` class. Adds the `show` class which
   * triggers the CSS transition.
   *
   * @param {string} sheetId The id of the sheet element to open.
   */
  function openBottomSheet(sheetId) {
    const sheet = document.getElementById(sheetId);
    if (sheet) sheet.classList.add('show');
  }

  /**
   * Closes a bottom sheet by removing the `show` class.
   *
   * @param {string} sheetId The id of the sheet element to close.
   */
  function closeBottomSheet(sheetId) {
    const sheet = document.getElementById(sheetId);
    if (sheet) sheet.classList.remove('show');
  }

  /**
   * Shows a modal overlay (like profile setup). The overlay itself
   * should have the `.modal-overlay` class. Adds the `show` class.
   *
   * @param {string} modalId The id of the modal overlay element.
   */
  function showModal(modalId) {
    const overlay = document.getElementById(modalId);
    if (overlay) overlay.classList.add('show');
  }

  /**
   * Hides a modal overlay by removing the `show` class.
   *
   * @param {string} modalId The id of the modal overlay element.
   */
  function closeModal(modalId) {
    const overlay = document.getElementById(modalId);
    if (overlay) overlay.classList.remove('show');
  }

  return {
    init,
    showToast,
    openBottomSheet,
    closeBottomSheet,
    showModal,
    closeModal
  };
})();