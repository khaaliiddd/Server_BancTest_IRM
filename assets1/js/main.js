/*===== LOGIN SHOW and HIDDEN =====*/
// function login() {
//   // Exemple simple : ici on valide le login
//   localStorage.setItem("isLoggedIn", "true"); // ou sessionStorage si tu préfères
//   window.location.href = "index.html"; // redirige vers l'accueil après login
// }
const signUp = document.getElementById("signUpButton"),
  signIn = document.getElementById("signInButton"),
  loginIn = document.getElementById("login-in"),
  loginUp = document.getElementById("login-up");

signUp.addEventListener("click", () => {
  // Remove classes first if they exist
  loginIn.classList.remove("block");
  loginUp.classList.remove("none");

  // Add classes
  loginIn.classList.toggle("none");
  loginUp.classList.toggle("block");
});

signIn.addEventListener("click", () => {
  // Remove classes first if they exist
  loginIn.classList.remove("none");
  loginUp.classList.remove("block");

  // Add classes
  loginIn.classList.toggle("block");
  loginUp.classList.toggle("none");
});
