// Express
const Express = require("express");
const ExpressSession = require("express-session");
const ExpressCompression = require("compression");
const SessionFileStore = require("session-file-store")(ExpressSession);
const ExpressWS = require("express-ws");
// Discord
const { Client, Events, GatewayIntentBits } = require("discord.js");

// Utils
const Path = require("path");
const QueryString = require("querystring");
const promisify = require("util").promisify;

// Our stuff
const Canvas = require("./canvas");

// Configs
const Config = require("./config.json");
const { config } = require("dotenv");
const { timeStamp } = require("console");
require("dotenv").config();



/* TODO
 * - Auto update the page like vite on any changes
 * - Sync stuff like cooldown and ban
 * - Polling system where the client polls new pixels every few seconds
 * - Log out
 * - Automatic session expiry (though ttl already does that so ???)
 * - Move more stuff to config like redirect url, etc
 */

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.login(process.env.BOT_TOKEN);

client.once(Events.ClientReady, c => {
	console.log("Ready! Logged in as", c.user.tag);
});

/*
 * ===============================
*/

const app = Express();
const port = 1300;
ExpressWS(app);


/*
 * ===============================
*/

app.use(Express.static(Path.join(__dirname, "public")));
app.use(ExpressSession({
	store: new SessionFileStore(
		{
			path: "./canvas/sessions",
			ttl: 7 * 24 * 60 * 60,
			retries: 0,
			encoder: data => JSON.stringify(data, null, "\t")
		}),
	secret: process.env.SESSION_SECRET,
	saveUninitialized: false,
	resave: false
}));
app.use(Express.json());

async function userInfo(req, res, next) {
	if (!req.session?.user) {
		return next();
	}

	req.user = req.session.user;

	try {
		req.member = await client.guilds.cache.get(Config.guild.id).members.fetch(req.session.user.id);
	}
	catch (e) {
	}

	next();
}



/*
 * ===============================
*/

const canvas = new Canvas().initialize({ sizeX: 500, sizeY: 500, colors: ["#ff4500", "#ffa800", "#ffd635", "#00a368", "#7eed56", "#2450a4", "#3690ea", "#51e9f4", "#811e9f", "#b44ac0", "#ff99aa", "#9c6926", "#000000", "#898d90", "#d4d7d9", "ffffff"] });
const io = new Canvas.IO(canvas, "./canvas/current.hst").read();

// day 2 colors

// const colors = [ "#ff4500", "#ffa800", "#ffd635", "#00a368", "#7eed56", "#2450a4", "#3690ea", "#51e9f4", "#811e9f", "#b44ac0", "#ff99aa", "#9c6926", "#000000", "#898d90", "#d4d7d9", "ffffff" ];

// day 3 colors
// const colors = [ "#be0039", "#ff4500", "#ffa800", "#ffd635", "#00a368", "#00cc78", "#7eed56", "#00756f", "#009eaa", "#2450a4", "#3690ea", "#51e9f4", "#493ac1", "#6a5cff", "#811e9f", "#b44ac0", "#ff3881", "#ff99aa", "#6d482f", "#9c6926", "#000000", "#898d90", "#d4d7d9", "#ffffff", ];

// day 4 colors
// const colors = [ "#6d001a", "#be0039", "#ff4500", "#ffa800", "#ffd635", "#fff8b8", "#00a368", "#00cc78", "#7eed56", "#00756f", "#009eaa", "#00ccc0", "#2450a4", "#3690ea", "#51e9f4", "#493ac1", "#6a5cff", "#94b3ff", "#811e9f", "#b44ac0", "#e4abff", "#de107f", "#ff3881", "#ff99aa", "#6d482f", "#9c6926", "#ffb470", "#000000", "#515252", "#898d90", "#d4d7d9", "#ffffff", ];

/*
 * ===============================
*/

const oauthRedirectUrl = "https://canvas.mares.place/auth/discord/redirect"
const oauthScope = "identify";
app.get("/credits", (req, res) => {
	const creditsPage = `
  <html lang="en">
  
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>Credits for mare place</title>
	  <style>
		  body {
			  background-color: #1a1a1a;
			  color: #ffffff;
			  font-family: Arial, sans-serif;
			  margin: 0;
			  padding: 0;
		  }
  
		  .container {
			  max-width: 600px;
			  margin: 0 auto;
			  padding: 20px;
		  }
  
		  h1 {
			  text-align: center;
		  }
  
		  .buttons {
			  margin-top: 20px;
			  text-align: center;
		  }
  
		  .buttons a {
			  display: inline-block;
			  margin: 10px;
			  padding: 15px 25px;
			  background-color: #3498db;
			  color: #ffffff;
			  text-decoration: none;
			  border-radius: 5px;
			  transition: background-color 0.3s;
		  }
  
		  .buttons a:hover {
			  background-color: #2980b9;
		  }
	  </style>
  </head>
  
  <body>
	  <div class="container">
		  <h1>Credits + Minimap Download</h1>
		  <p>This is an open source canvas developed by Mercurial aka Mercy. It was originally used for Manechats 8th anniversary!</p>
  
		  <div class="buttons">
			  <a href="https://github.com/Manechat/place.manechat.net">GitHub Repository from Merc</a>
			  <a href="https://github.com/StarshinePony/mareplace">Github Repository of this instance</a>
		  </div>
		  <p>Wanna use a template overlay? Download the Minimap here! [FYI] > You need the tampermonkey extension for this to work! (Info: We are trying to implement the minimap into the website itself so you can use it on mobile aswell!</p>
		  <div class="buttons">
			  <a href="https://www.tampermonkey.net/">Tampermonkey</a>
			  <a href="https://github.com/StarshinePony/2023-minimap/raw/main/minimap.user.js">Download Script</a>
			  <a href="/ui">Go back to the main page</a>
		  </div>
	  </div>
  </body>
  
  </html>
  `;

	res.send(creditsPage);
});
app.get("/auth/discord", (req, res) => {
	// HTML-Seite mit Bestätigungsnachricht und Weiterleitungslink anzeigen
	const query = QueryString.encode({
		client_id: process.env.CLIENT_ID,
		scope: oauthScope,
		redirect_uri: oauthRedirectUrl,
		response_type: "code",
	});
	const confirmationPage = `
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>maresplace - GDPR Compliant Terms of Service</title>
    <style>
        body {
            background-color: #1a1a1a;
            color: #ffffff;
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }

        h1 {
            text-align: center;
        }

        .buttons {
            margin-top: 20px;
            text-align: center;
        }

        .buttons a {
            display: inline-block;
            margin: 10px;
            padding: 15px 25px;
            background-color: #3498db;
            color: #ffffff;
            text-decoration: none;
            border-radius: 5px;
            transition: background-color 0.3s;
        }

        .buttons a:hover {
            background-color: #2980b9;
        }
    </style>
</head>

<body>
    <div class="container">
        <h1>Welcome to Mare Place!</h1>
        <p>By clicking "Yes, i agree", you acknowledge and agree to the collection and processing of your data in accordance with the General Data Protection Regulation (GDPR) and other applicable data protection laws. The data collected on this website includes:
<br><br>
    User Agent: Information about your web browser and device operating system, utilized to optimize our website for various devices and browsers.
<br><br>
    IP Address: Your IP address is collected for website security, fraud detection, general demographic analysis, and understanding the geographical distribution of our users.
<br><br>
    Timestamp: The time of your access to our website is logged for monitoring website performance, troubleshooting errors, and analyzing general user behavior.
<br><br>
We do not collect or store any personally identifiable information (PII) such as names, addresses, or phone numbers. Your privacy is of utmost importance to us, and we are committed to safeguarding your data.
<br><br>
Legal Basis for Data Processing:
<br><br>
The processing of your data is based on your consent, which you provide by clicking "OK" on our website. You have the right to withdraw your consent at any time. Withdrawal of consent does not affect the lawfulness of processing based on consent before its withdrawal.
<br><br>
Data Retention:
<br><br>
The collected data will be retained only for as long as necessary (2 days) to fulfill the purposes for which it was collected, or as required by applicable laws and regulations.
<br><br>
Your Rights:
<br><br>
Under the GDPR, you have the right to request access to, rectification, or erasure of your personal data, as well as the right to restrict or object to processing, and the right to data portability. To exercise any of these rights, please contact us at <a href="mailto:myponylittleheart@gmail.com" style="color:aqua;">myponylittleheart@gmail.com</a>.</p>

By agreeing to these GDPR-compliant Terms of Service, you consent to the collection and processing of the aforementioned data. If you do not agree with these terms, we kindly ask you not to continue using our website.
</p>

        <div class="buttons">
            <a href="https://discord.com/api/oauth2/authorize?${query}">Yes, I agree!</a>
            <a href="/ui">Nope, I don't agree :(</a>
        </div>

        <p style="margin-top: 20px;">Thank you for your understanding and cooperation.</p>
        <p>Sincerely,<br>maresplace<br>05.10.2023<br>Contact: <a href="mailto:myponylittleheart@gmail.com" style="color:aqua;">myponylittleheart@gmail.com</a></p>
    </div>
</body>

</html>

  `;

	res.send(confirmationPage);
});



app.get("/auth/discord/redirect", async (req, res) => {
	const code = req.query.code;

	if (!code) {
		return res.redirect("/ui");
	}

	const authRes = await fetch("https://discord.com/api/oauth2/token",
		{
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams(
				{
					client_id: process.env.CLIENT_ID,
					client_secret: process.env.CLIENT_SECRET,
					grant_type: "authorization_code",
					scope: oauthScope,
					redirect_uri: oauthRedirectUrl,
					code
				})
		});

	if (!authRes.ok) {
		return res.redirect("/ui");
	}

	const auth = await authRes.json();

	const userRes = await fetch("https://discord.com/api/users/@me",
		{
			headers: { Authorization: `${auth.token_type} ${auth.access_token}` }
		});

	if (!userRes.ok) {
		return res.redirect("/ui");
	}

	await promisify(req.session.regenerate.bind(req.session))(); // TODO: Clean old sessions associated with this user/id
	req.session.user = await userRes.json();

	res.redirect("/ui");
});



app.get("/initialize", userInfo, async (req, res) => {
	if (!req.user) {
		return res.json({ loggedIn: false, banned: false, mod: false, cooldown: 0, settings: canvas.settings });
	}

	res.json({ loggedIn: true, banned: isBanned(req.member), mod: isMod(req.member), cooldown: canvas.users.get(req.user.id).cooldown, settings: canvas.settings });
	console.log(res.json)
	console.log(res.json.banned, res.json.mod)
});

app.get('/', function (req, res) {
	const currentTimestampSeconds = Math.floor(Date.now() / 1000);
	if (Config.canvasEnablesAt < currentTimestampSeconds) {
		res.redirect('/ui');
		return;
	}
	console.log(Config.canvasEnablesAt, currentTimestampSeconds)
	app.use(Express.static('gifs'));
	const watingPage = `
<!DOCTYPE html>
<html>
<head>
    <title>Soon :D</title>
    <style>
		  body {
			  background-color: #1a1a1a;
			  color: #ffffff;
			  font-family: Arial, sans-serif;
			  margin: 0;
			  padding: 0;
		  }
  
		  .container {
			  max-width: 600px;
			  margin: 0 auto;
			  padding: 20px;
		  }
		  loading-screen {
			position: absolute;
			display: flex;
			justify-content: center;
			align-items: center;
			image-align: center;
		  }
  
		  h1 {
			  text-align: center;
		  }
		  p {
			text-align: center;
		  }
		  .countdown {
			text-align: center;
			font-size: 36px;
		  }
		  .minimapinfo {
			text-align: center;
			font-size: 36px;
		  }
  
		  .buttons {
			  margin-top: 20px;
			  text-align: center;
		  }
  
		  .buttons a {
			  display: inline-block;
			  margin: 10px;
			  padding: 15px 25px;
			  background-color: #3498db;
			  color: #ffffff;
			  text-decoration: none;
			  border-radius: 5px;
			  transition: background-color 0.3s;
		  }
  
		  .buttons a:hover {
			  background-color: #2980b9;
		  }
	  </style>
</head>
<body>
    <h1>Mare Place opens in:</h1>
    <div id="countdown" class="countdown"></div>


	<div id="loading-screen" class="countdown">
		<img src="./Server_Icon.gif">
	</div>
	<div id="minimapinfo" class"countdown">
		<p>If you are bored you can already install the template overlay here!</p>
		  	<div class="buttons">
			  	<a href="https://www.tampermonkey.net/">Tampermonkey</a>
			  	<a href="https://github.com/StarshinePony/2023-minimap/raw/main/minimap.user.js">Download Script</a>
				<a href="https://discord.gg/bronyplace">Join the Discord!</a>
		  	</div>
	</div>
    <script>
        const targetTimestamp = 1697288400;
 
        function updateCountdown() {
            const currentTimestamp = Math.floor(Date.now() / 1000);
            const timeRemaining = targetTimestamp - currentTimestamp;

            if (timeRemaining <= 0) {
                document.getElementById('countdown').innerHTML = "Mare Place is now open! Refresh you page!";
            } else {
                const days = Math.floor(timeRemaining / (60 * 60 * 24));
                const hours = Math.floor((timeRemaining % (60 * 60 * 24)) / (60 * 60));
                const minutes = Math.floor((timeRemaining % (60 * 60)) / 60);
                const seconds = timeRemaining % 60;
				

                const countdownText = \`\${days}d \${hours}h \${minutes}m \${seconds}s\`;
                document.getElementById('countdown').innerHTML = '<strong>' + countdownText + '</strong>';
            }
        }
        updateCountdown();

        setInterval(updateCountdown, 1000);
    </script>
</body>
</html>
`;


	res.send(watingPage);


});


app.get("/canvas", ExpressCompression(), (req, res) => {
	res.contentType("application/octet-stream");
	res.send(canvas.pixels.data);
});



app.post("/place", userInfo, async (req, res) => {
	if (!req.member) {
		return res.status(401).send();
	}

	if (isBanned(req.member)) {
		return res.status(403).send();
	}

	const placed = canvas.place(+req.body.x, +req.body.y, +req.body.color, req.member.user.id);

	res.send({ placed });
});
app.post("/adminPlace", userInfo, async (req, res) => {
	if (!req.member) {
		return res.status(401).send();
	}

	if (isBanned(req.member)) {
		return res.status(403).send();
	}
	if (!isMod(req.member)) {
		return
	}

	const placed = canvas.adminPlace(+req.body.x, +req.body.y, +req.body.color, req.member.user.id);

	res.send({ placed });
});





app.post("/placer", async (req, res) => {
	if (!canvas.isInBounds(+req.body.x, +req.body.y)) {
		return res.json({ username: "" });
	}

	const pixelInfo = canvas.info[+req.body.x][+req.body.y];

	if (!pixelInfo) {
		return res.json({ username: "" });
	}

	try {
		const member = await client.guilds.cache.get(Config.guild.id).members.fetch(pixelInfo.userId.toString());

		if (member && member.nickname) {
			return res.json({ username: member.nickname });
		}
	}
	catch (e) {
	}

	const user = await client.users.fetch(pixelInfo.userId.toString());

	if (!user) {
		return res.json({ username: "" });
	}

	res.json({ username: user.username });
});



/*
 * ===============================
*/

function isBanned(member) {
	if (!member) {
		return true;
	}

	if (Config.guild.moderatorRoles.some(roleId => member.roles.cache.has(roleId))) {
		return false;
	}

	return member.communication_disabled_until || Config.guild.bannedRoles.some(roleId => member.roles.cache.has(roleId));
}
function isMod(member) {
	if (!member) {
		return false;
	}

	if (Config.guild.moderatorRoles.some(roleId => member.roles.cache.has(roleId))) {
		return true;
	}

	return false;
}

/*
 * ===============================
*/

let idCounter = 0;
const clients = new Map();

canvas.addListener("pixel", (x, y, color) => {
	console.log("Pixel sent to " + clients.size + " - " + new Date().toString());
	const buf = io.serializePixelWithoutTheOtherStuff(x, y, color);
	for (const socket of clients.values()) {
		socket.send(buf);
	}
});
/*
app.setUpSockets = () => // TODO: THis is really ugly because of Greenlock
{

	try {
		app.ws("/", ws => {
			const clientId = idCounter++;
			console.log("socket connected")

			clients.set(clientId, ws);

			ws.on("close", () => {
				clients.delete(clientId);
			});
		});
	} catch (error) {
		console.log("some error. dont know dont care");
	}

}*/
let connectedClientsCount = 0;
app.setUpSockets = () => {
	try {
		app.ws("/", ws => {
			const clientId = idCounter++;
			console.log("socket connected");
			connectedClientsCount++;

			clients.set(clientId, ws);

			ws.on("close", () => {
				connectedClientsCount--;


				clients.delete(clientId);
			});
		});
	} catch (error) {
		console.log("some error. don't know, don't care");
	}
};
app.setUpSockets();
app.get("/connectedClientsCount", (req, res) => {
	res.json({ connectedClientsCount });
});

/*
 * ===============================
*/
app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});


module.exports = app;


