import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "../firebase/firebase";
import { toast } from "react-toastify";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom"; // Import navigation hook

function SignInWithGoogle() {
  const navigate = useNavigate();
  const provider = new GoogleAuthProvider();

  async function googleLogin() {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (user) {
        // Check if user already exists in Firestore
        const userRef = doc(db, "Users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          // New user - Redirect to register page for profile completion
          navigate("/register", { state: { email: user.email, uid: user.uid } });
        } else {
          // Existing user - Redirect to dashboard
          toast.success("Welcome back!", { position: "top-center" });
          navigate("/dashboard");
        }
      }
    } catch (error) {
      if (error.code === "auth/popup-closed-by-user") {
        toast.warn("Sign-in cancelled. Please try again.", { position: "top-center" });
      } else if (error.code === "auth/operation-not-allowed") {
        toast.error("Google Sign-In is disabled. Enable it in Firebase Console.", { position: "top-center" });
      } else {
        toast.error("Login failed. Try again!", { position: "top-center" });
      }
      console.error("Google Sign-In Error:", error);
    }
  }

  return (
    <div className="google-signin-container">
      <button className="google-signin-btn" onClick={googleLogin}>
        <img src="/google.png" alt="Google Logo" className="google-icon" />
        Continue with Google
      </button>
    </div>
  );
}

export default SignInWithGoogle;
