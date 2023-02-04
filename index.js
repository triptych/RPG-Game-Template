// setup express server
const express = require("express");
const app = express();
const server = require("node:http").createServer(app);
const port = process.env.PORT || 8080;
// setup db
const db = require("ez-repldb");
db.cache();
// setup WebSockets (functions near identically to Socket.IO)
const wss = require("./WebSockets")(server);
// require fs for reading and writing messages to JSON
const fs = require("node:fs");

// host the public folder statically
app.use(express.static("public"));

// authentication
app.use(function(req, res, next) {
	// check if the authentication headers are set
	if (req.headers["x-replit-user-id"] && req.headers["x-replit-user-id"] !== "") {
		// create an object to store the user info
		req.user = {};
		// get all the headers
		const headers = Object.keys(req.headers);
		// iterate through each header
		for (let i = 0; i < headers.length; i++) {
			// if the header is a Replit header
			if (headers[i].substr(0, 14) === "x-replit-user-") {
				// store it with the user info
				req.user[headers[i].substr(14)] = req.headers[headers[i]];
			}
		}
	} else {
		// if the user isn't authenticated, the user info is `null`
		req.user = null;
	}
	next();
});

// host the homepage
app.get(["/", "/Home"], function(req, res) {
	res.sendFile(__dirname + "/pages/home.html");
});
// host the chat section
app.get("/Chat", function(req, res) {
	// require authentication
	if (!req.user) {
		res.sendFile(__dirname + "/pages/not-authed.html");
	} else {
		res.sendFile(__dirname + "/pages/chat.html");
	}
});
// host the leaderboard
app.get("/Leaderboard", function(req, res) {
	// require authentication
	if (!req.user) {
		res.sendFile(__dirname + "/pages/not-authed.html");
	} else {
		res.sendFile(__dirname + "/pages/leaderboard.html");
	}
});

// 404 page
app.use(function(req, res) {
	res.status(404);
	res.sendFile(__dirname + "/pages/404.html");
});

// real-time communication
(function WebSockets() {
	// load all messages from the JSON file
	const messages = [];
	fs.readFile("messages.json", function(err, data) {
		if (!err) {
			const msgs = JSON.parse(data).messages;
			for (let i = 0; i < msgs.length; i++) {
				messages.push(msgs[i]);
			}
		}
	});
	// function to write all messages to the JSON file
	function saveMessages() {
		fs.writeFile("messages.json", JSON.stringify({ messages }), function(err) { return err; });
	}
	// when a user connects
	wss.on("connect", function(socket) {
		// if the user is authenticated
		if (socket.user) {
			// attempt to get their data from the database
			db.get(socket.user.id)
				.then(function(user) {
					// if they have not yet been added to the database
					if (!user) {
						// add them (based on their id)
						db.set(socket.user.id, {
							id: socket.user.id,
							name: socket.user.name,
							creation_date: Date.now()
						});
					}
				});
		}
		// if the client requests information about the user signed in
		socket.on("user", function() {
			// send information about the user signed in
			socket.emit("user", socket.user);
		});
		// if the client requests information about the previous messages
		socket.on("messages", function() {
			socket.emit("messages", messages);
		});
		// if the client sends a message
		socket.on("message", function(message) {
			// add the author to the message
			message.author = socket.user.name;
			// double check that someone didn't try anything sneaky with developer tools on the client-side
			if (message.content.trim().length > 0) {
				// if the time stamp is suspiciously different from the server (more than ten seconds off)
				if (Math.abs(message.time_stamp - Date.now()) > 10000) {
					//set it on the server
					message.time_stamp = Date.now();
				}
				// add the message to the array of messages
				messages.push(message);
				// save all the messages to the JSON file
				saveMessages();
				// send the message to the clients
				socket.emit("messages", [message]);
			}
		});
		// if the client requests information about the leaderboard
		socket.on("leaderboard", function() {
			// get all users
			db.getAll()
				.then(function(users) {
					// array to store leaderboard
					const leaderboard = [];
					// add each user to the leaderboard
					for (const id in users) {
						leaderboard.push(users[id]);
					}
					// sort the leaderboard based on account creation date
					leaderboard.sort(function(a, b) {
						return a.creation_date < b.creation_date ? 1 : -1;
					});
					// send the leaderboard to the client
					socket.emit("leaderboard", leaderboard);
				});
		});
	});
})();

server.listen(port);