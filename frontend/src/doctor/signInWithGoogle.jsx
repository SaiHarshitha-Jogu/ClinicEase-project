import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from  "../firebase/firebase";
import { toast } from "react-toastify";
import { setDoc, doc } from "firebase/firestore";
// import "./SignInWithGoogle.css";

function SignInWithGoogle() {
  async function googleLogin() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      if (user) {
        await setDoc(doc(db, "Users", user.uid), {
          email: user.email,
          firstName: user.displayName,
          photo: user.photoURL,
          lastName: "",
        });
        toast.success("User logged in successfully", {
          position: "top-center",
        });
        window.location.href = "/dashboard";
      }
    } catch (error) {
      toast.error("Login failed. Try again!", { position: "top-center" });
      console.error("Google Sign-In Error:", error);
    }
  }

  return (
    <div className="google-signin-container">
      {/* <p className="continue-text">--Or--</p> */}
      <button className="google-signin-btn" onClick={googleLogin}>
        <img src="/google.png" alt="Google Logo" className="google-icon" />
        Continue with Google
      </button>
    </div>
  );
}

export default SignInWithGoogle;