import {
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	signInWithPopup,
	GoogleAuthProvider,
	GithubAuthProvider,
	signOut as firebaseSignOut,
	type UserCredential,
  } from 'firebase/auth';
  import { auth } from '@/shared/config/firebase';

  const googleProvider = new GoogleAuthProvider();
  const githubProvider = new GithubAuthProvider();

  export const signUpWithEmail = (
	email: string,
	password: string
  ): Promise<UserCredential> => {
	return createUserWithEmailAndPassword(auth, email, password);
  };

  export const signInWithEmail = (
	email: string,
	password: string
  ): Promise<UserCredential> => {
	return signInWithEmailAndPassword(auth, email, password);
  };

  export const signInWithGoogle = (): Promise<UserCredential> => {
	return signInWithPopup(auth, googleProvider);
  };

  export const signInWithGithub = (): Promise<UserCredential> => {
	return signInWithPopup(auth, githubProvider);
  };

  export const signOut = (): Promise<void> => {
	return firebaseSignOut(auth);
  };
