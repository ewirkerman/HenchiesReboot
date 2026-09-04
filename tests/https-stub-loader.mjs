export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('https://www.gstatic.com/firebasejs/')) {
    const code = `
      export const initializeApp = () => ({})
      export const getFirestore = () => ({})
      export const doc = () => ({})
      export const setDoc = async () => {}
      export const getDoc = async () => ({ exists: () => false, data: () => ({}) })
      export const onSnapshot = () => {}
      export const updateDoc = async () => {}
      export const arrayUnion = (...items) => items
      export const collection = () => ({})
      export const getDocs = async () => ({ docs: [] })
      export const addDoc = async () => ({ id: 'stub' })
      export const deleteDoc = async () => {}
      export const query = () => ({})
      export const where = () => ({})
      export const getStorage = () => ({})
      export const ref = () => ({})
      export const uploadBytes = async () => {}
      export const getDownloadURL = async () => ''
      export const getAuth = () => ({})
      export const signInAnonymously = async () => ({})
      export const onAuthStateChanged = () => {}
    `;
    return {
      shortCircuit: true,
      url: `data:text/javascript,${encodeURIComponent(code)}`,
    };
  }

  return nextResolve(specifier, context);
}
