// this modules enables a standardised navigation bar across pages
const nav = function(user) {
	// nav bar
	const navbar = document.createElement("nav");

	// home button
	const home = document.createElement("a");
	home.classList.add("left");
	home.setAttribute("href", "/Home");
	home.textContent = "Home";
	navbar.append(home);

	// chat button
	const chat = document.createElement("a");
	chat.classList.add("left");
	chat.setAttribute("href", "/Chat");
	chat.textContent = "Chat";
	navbar.append(chat);

	// leaderboard button
	const leaderboard = document.createElement("a");
	leaderboard.classList.add("left");
	leaderboard.setAttribute("href", "/Leaderboard");
	leaderboard.textContent = "Leaderboard";
	navbar.append(leaderboard);

	// if the user is not authenticated
	if (!user) {
		// login button
		const login = document.createElement("button");
		login.classList.add("right");
		login.textContent = "Login";
		login.addEventListener("click", function() {
			window.addEventListener("message", authComplete);

			const width = 350;
			const height = 500;
			const left = screen.width / 2 - width / 2;
			const top = screen.height / 2 - height / 2;

			const authWindow = window.open("https://repl.it/auth_with_repl_site?domain=" + window.location.host, "_blank", `modal=yes, toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=no, resizable=no, copyhistory=no, width=${width}, height=${height}, top=${top}, left=${left}`);

			function authComplete(e) {
				if (e.data !== "auth_complete") {
					return;
				}
				window.removeEventListener("message", authComplete);
				authWindow.close();
				window.location.reload();
			}
		});
		navbar.append(login);
	}

	// add the nav bar to the document
	document.body.prepend(navbar);
};

export { nav as default };