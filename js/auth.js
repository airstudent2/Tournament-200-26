/**
 * Authentication helpers for both user and admin panels.
 * Provides simple wrappers around Firebase authentication to handle
 * anonymous sign-in and email/password sign-in. Errors are bubbled up
 * to the caller so UI can display appropriate feedback. It also
 * exposes a sign-out method used in the admin panel.
 */

const Auth = (() => {
  /**
   * Signs in the current client anonymously. This is used in the user
   * facing portion of the app. Anonymous auth is silent and does not
   * require any user interaction. On success, a user object with a
   * unique UID is returned via the promise.
   *
   * @returns {Promise<firebase.User>}
   */
  function signInAnon() {
    return firebase.auth().signInAnonymously().catch((error) => {
      console.error("Anonymous sign-in failed", error);
      throw error;
    });
  }

  /**
   * Signs in an admin using an email and password. This method is used
   * exclusively on the admin panel. It returns a promise that
   * resolves with the signed in user on success. Failures should be
   * handled by the caller.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<firebase.UserCredential>}
   */
  function signInWithEmail(email, password) {
    return firebase.auth().signInWithEmailAndPassword(email, password);
  }

  /**
   * Signs out the current user. Used in the admin panel when the admin
   * wishes to log out. Returns a promise.
   *
   * @returns {Promise<void>}
   */
  function signOut() {
    return firebase.auth().signOut();
  }

  return {
    signInAnon,
    signInWithEmail,
    signOut
  };
})();