/* La autorización real se aplica en firestore.rules. Esta pantalla no sustituye esas reglas. */
(() => {
  const demo = new URLSearchParams(location.search).has('demo');
  const allowedEmails = ['servtecfueltek@gmail.com', 'fueltekchile@gmail.com'];
  let authorized = false;
  let releaseAccess;
  window.fueltekAccessReady = new Promise(resolve => { releaseAccess = resolve; });
  window.fueltekRequireAccess = () => {
    if (!demo && !authorized) throw new Error('Ingresa con una cuenta autorizada del taller.');
  };
  const permitted = user => Boolean(user && user.emailVerified && allowedEmails.includes((user.email || '').toLowerCase()) && user.providerData.some(provider => provider.providerId === 'google.com'));
  const errorMessage = error => ({
    'auth/popup-blocked':'Tu navegador bloqueó la ventana. Permite ventanas emergentes para este sitio y vuelve a ingresar.',
    'auth/popup-closed-by-user':'El ingreso se canceló. Puedes volver a intentarlo.',
    'auth/unauthorized-domain':'El dominio todavía no está autorizado en Firebase. Contacta al administrador.',
    'auth/operation-not-allowed':'El acceso con Google todavía no está habilitado en Firebase.',
    'auth/network-request-failed':'No se pudo conectar. Revisa tu conexión y vuelve a intentarlo.'
  }[error?.code] || 'No se pudo iniciar sesión. Vuelve a intentarlo.');
  document.addEventListener('DOMContentLoaded', async () => {
    const panel = document.getElementById('accessPanel');
    const signIn = document.getElementById('signIn');
    const status = document.getElementById('accessStatus');
    const bar = document.getElementById('sessionBar');
    const identity = document.getElementById('sessionIdentity');
    if (demo) {
      document.body.classList.remove('auth-pending'); panel.classList.add('hidden'); releaseAccess(); return;
    }
    if (!window.firebase?.auth || !firebase.apps.length) {
      status.textContent = 'No se pudo cargar el acceso. Revisa tu conexión y recarga la página.'; return;
    }
    const auth = firebase.auth();
    auth.languageCode = 'es';
    try { await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION); }
    catch (error) { status.textContent = 'El navegador no permite mantener una sesión. Habilita el almacenamiento del sitio y recarga.'; return; }
    signIn.disabled = false;
    auth.onAuthStateChanged(async user => {
      authorized = permitted(user);
      document.body.classList.toggle('auth-pending', !authorized);
      panel.classList.toggle('hidden', authorized);
      bar.classList.toggle('hidden', !authorized);
      identity.textContent = authorized ? `Sesión del taller · ${user.email}` : '';
      if (authorized) {
        releaseAccess();
        document.dispatchEvent(new Event('fueltek:refresh'));
      } else if (user) {
        status.textContent = 'Esta cuenta no tiene acceso al taller. Ingresa con una cuenta autorizada.';
        await auth.signOut();
      } else if (!status.textContent.includes('no tiene acceso')) {
        status.textContent = 'Tu sesión se mantiene en esta pestaña. Cierra sesión cuando termines en un equipo compartido.';
      }
    }, () => { status.textContent = 'No se pudo verificar la sesión. Recarga la página.'; });
    signIn.onclick = async () => {
      signIn.disabled = true; status.textContent = 'Abriendo el ingreso seguro con Google…';
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({prompt:'select_account'});
      try { await auth.signInWithPopup(provider); }
      catch (error) { status.textContent = errorMessage(error); }
      finally { signIn.disabled = false; }
    };
    document.getElementById('signOut').onclick = async () => {
      if (window.fueltekDirty && !confirm('Hay cambios sin guardar. Se conservará el borrador en este equipo. ¿Cerrar sesión?')) return;
      try { await auth.signOut(); status.textContent = 'Sesión cerrada. Las órdenes guardadas y el borrador local se conservan.'; }
      catch (error) { status.textContent = 'No se pudo cerrar la sesión. Vuelve a intentarlo.'; }
    };
  });
})();
