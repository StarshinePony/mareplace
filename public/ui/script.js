// TODO: wait for page to load

// TODO: No zoom if recent gesture
// TODO: multi touch pan
// TODO: mobile click to pan

// TODO: don't pan on picker/buttons

// TODO: change easing function on ios?

// TODO: box shadow on selector pixel
// TODO: zoom on click





// TODO reload page if we are unauthorized

let pixelSize = 1;

function isIOS() {
	return /iPad|iPhone|iPod/.test(navigator.userAgent); // TODO: Mac?
}



const loadingScreen = document.getElementById("loading-screen");
const main = document.getElementById("main");
const selector = document.getElementById("selector");
const canvas = main.querySelector("#canvas");
const placeButton = document.getElementById("place");
const placeText = placeButton.querySelector(".action");
const coordText = placeButton.querySelector(".info");
const picker = document.getElementById("picker");
const painter = document.getElementById("paint");
const confirm = document.getElementById("confirm");
const selectorBorder = selector.querySelector("#selector-border");
const selectorPixel = selector.querySelector("#selector-pixel");
const pixelColor = selectorPixel.querySelector("#pixel-color");
const shareTooltip = document.getElementById("share-tooltip");
const placerTooltip = document.getElementById("placer-tooltip");
const colorsContainer = document.getElementById("colors");
const adminColorsContainer = document.getElementById("adminColors");
const modUi = document.getElementById("modUi");
const modtools = modUi.querySelector("#modplace");
const modPlace = document.getElementById("modplace")
const mappi = document.getElementById("minimapui")


function setSize(sizeX, sizeY) {
	main.style.width = sizeX + "px";
	main.style.height = sizeY + "px";
	canvas.width = sizeX * pixelSize;
	canvas.height = sizeY * pixelSize;
	canvas.style.maxWidth = sizeX + "px";
	canvas.style.maxHeight = sizeY + "px";
}



const selectSound = new Howl({ src: ["./sounds/select.mp3"], volume: 0.2 });
const cancelSound = new Howl({ src: ["./sounds/cancel.mp3"], volume: 0.2 });
const pickSound = new Howl({ src: ["./sounds/pick.mp3"], volume: 0.2 });
const placeSound = new Howl({ src: ["./sounds/place.mp3"], volume: 0.2 });
const errorSound = new Howl({ src: ["./sounds/error.mp3"], volume: 0.2 });
const refreshSound = new Howl({ src: ["./sounds/refresh.mp3"], volume: 0.2 });
const clickSound = new Howl({ src: ["./sounds/click.mp3"], volume: 0.2 });



let selectTimer;
let lastResizeTime = 0;

let selectX = 0;
let selectY = 0;

let cooldown = 0;
let maxCooldown = 10;

let shareTooltipTimer;
let placerTooltipTimer;

let loggedIn = false;
let banned = false;
let mod = false;



function toUInt16(b1, b2) {
	return (b1 << 8) | b2;
}

function toUInt24(b1, b2, b3) {
	return (b1 << 16) | (b2 << 8) | b3;
}

function rgbIntToHex(rgbInt) {
	return "#" + rgbInt.toString(16).padStart(6, "0");
}

function reloadPage() {
	location.reload();
}

function delayedReloadPage() {
	setTimeout(reloadPage, 2000);
}


fetch("/initialize")
	.then(res => res.json())
	.then(res => {
		loggedIn = res.loggedIn;
		banned = res.banned;
		mod = res.mod;
		console.log(mod)
		modtools.classList.add("hidden")
		if (mod) {
			modtools.classList.remove("hidden")
		}

		if (isIOS()) // fix for iOS blurring the canvas for some odd reason... 
		{
			pixelSize = Math.floor(4000 / res.settings.sizeX);
		}

		setSize(res.settings.sizeX, res.settings.sizeY);
		centerCanvas();

		maxCooldown = res.settings.maxCooldown;
		startCooldown(res.cooldown);

		setColors(res.settings.colors);
		setAdminColors(res.settings.colors);
		updatePlaceButton();
	})
	.then(repaintCanvas)
	.then(() => {
		const socket = new WebSocket("wss://" + window.location.host);
		/*try{
			const socket = new Websocket("wss://" + window.location.host);
		}
		catch(err){
			console.log("Websocket Invalid")
		}
		socket.onerror = function error{
			console.log(error)
		}*/
		socket.addEventListener("message", async e => {
			const bytes = new Uint8Array(await e.data.arrayBuffer());

			const x = toUInt16(bytes[0], bytes[1]);
			const y = toUInt16(bytes[2], bytes[3]);
			const color = toUInt24(bytes[4], bytes[5], bytes[6]);

			ctx.fillStyle = rgbIntToHex(color);
			ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
		});

		socket.addEventListener("error", delayedReloadPage);
		socket.addEventListener("close", delayedReloadPage);
	})
	.then(() => {
		loadingScreen.classList.add("hidden");
	});
console.log(mod)
async function repaintCanvas() {
	const canvasRes = await fetch("/canvas");

	if (!canvasRes.ok) {
		return delayedReloadPage();
	}

	const buf = await canvasRes.arrayBuffer();

	const image = new ImageData(new Uint8ClampedArray(buf), canvas.width / pixelSize);

	ctx.imageSmoothingEnabled = false;
	ctx.drawImage(await createImageBitmap(image, 0, 0, image.width, image.height), 0, 0, image.width * pixelSize, image.height * pixelSize);
}

let lastSwitchTime = 0;

document.addEventListener("visibilitychange", () => {
	if (document.visibilityState !== "visible") {
		return;
	}

	if (Date.now() - lastSwitchTime > 5000) {
		repaintCanvas();
	}

	lastSwitchTime = Date.now();
});



const bounds = {};

function updateBounds() {
	bounds.left = document.body.clientWidth / 2.0 + 1.0;
	bounds.top = document.body.clientHeight / 2.0 + 1.0;
	bounds.right = document.body.clientWidth / 2.0;
	bounds.bottom = document.body.clientHeight / 2.0;
}

updateBounds();

const instance = panzoom(main, { smoothScroll: false, zoomDoubleClickSpeed: 1, minZoom: 0.5, maxZoom: 40, bounds });

instance.on("panend", e => {
	e.moveBy(0, 0, smooth = true); // cancel movement from onpointerup
	clearTimeout(selectTimer);
});



async function showPlacerTooltip() {
	const placerRes = await fetch("/placer",
		{
			method: "POST",
			headers: new Headers({ "content-type": "application/json" }),
			body: JSON.stringify({ x: selectX, y: selectY })
		});

	const placerName = (await placerRes.json()).username;

	if (!placerName) {
		return;
	}

	placerTooltip.innerHTML = placerName;

	placerTooltip.classList.add("visible");
}

function hidePlacerTooltip() {
	placerTooltip.classList.remove("visible");
}



let justCreated = true;

instance.on("transform", e => {
	if (justCreated) // TODO: Dirty hack
	{
		justCreated = false;
		return;
	}

	const transform = e.getTransform();

	// TODO: move the bounding logic earlier so that it's smoother
	// use document.body.client* instead of window.inner* because it's inaccurate on android devices for some odd reason?????
	const centerX = (document.body.clientWidth / 2.0 - transform.x) / transform.scale;
	const centerY = (document.body.clientHeight / 2.0 - transform.y) / transform.scale;

	selectX = Math.floor(centerX);
	selectY = Math.floor(centerY);

	window.sessionStorage.setItem("x", centerX);
	window.sessionStorage.setItem("y", centerY);
	window.sessionStorage.setItem("s", transform.scale);

	selector.style.transform = `translate(${selectX}px, ${selectY}px)`;

	coordText.textContent = `(${selectX}, ${selectY}) ${transform.scale.toFixed(transform.scale < 1 ? 1 : 0)}X`;

	clearTimeout(placerTooltipTimer);
	hidePlacerTooltip();

	if (transform.scale < 30) {
		return;
	}

	placerTooltipTimer = setTimeout(showPlacerTooltip, 200);
});

main.onmouseup = e => {
	if (Date.now() - lastResizeTime <= 200) // prevent this from triggering in a rare scenario where the titlebar is double clicked to resize the window
	{
		return;
	}

	const cx = document.body.clientWidth / 2.0;
	const cy = document.body.clientHeight / 2.0;

	instance.moveBy(cx - e.x, cy - e.y, smooth = true, duration = 1300);

	selectTimer = setTimeout(() => selectSound.play(), 10);
}

let lastWidth = 0;
let lastHeight = 0;

function centerCanvas() {
	lastWidth = document.body.clientWidth;
	lastHeight = document.body.clientHeight;

	const query = new URLSearchParams(window.location.search);

	let qx = parseFloat(query.get("x"));
	let qy = parseFloat(query.get("y"));
	let qs = parseFloat(query.get("s"));

	if (centerTo(qx, qy, qs)) {
		window.history.replaceState(null, "", "/");
		return;
	}

	const sx = parseFloat(window.sessionStorage.getItem("x"));
	const sy = parseFloat(window.sessionStorage.getItem("y"));
	const ss = parseFloat(window.sessionStorage.getItem("s"));

	if (centerTo(sx, sy, ss)) {
		return;
	}

	instance.moveTo((lastWidth - canvas.width / pixelSize) / 2.0, (lastHeight - canvas.height / pixelSize) / 2.0);
}

function centerTo(x, y, s) {
	if (isFinite(x) && isFinite(y) && isFinite(s)) {
		instance.moveTo(lastWidth / 2.0 - x, lastHeight / 2.0 - y);
		instance.zoomTo(lastWidth / 2.0, lastHeight / 2.0, s);

		return true;
	}

	return false;
}
const connectedClientsCountElement = document.getElementById("displayusers");

// Function to update the connected clients count
function updateConnectedClientsCount() {
	fetch("/connectedClientsCount") // Assuming you have an endpoint to fetch the count
		.then((response) => response.json())
		.then((data) => {
			const count = data.connectedClientsCount;
			connectedClientsCountElement.innerHTML = `Connected Clients: ${count}`;
		})
		.catch((error) => {
			console.error("Error fetching connected clients count:", error);
		});
}

updateConnectedClientsCount();


setInterval(updateConnectedClientsCount, 5000);

function recenterCanvas() {
	const dw = document.body.clientWidth - lastWidth;
	const dh = document.body.clientHeight - lastHeight;

	instance.moveBy(dw / 2.0, dh / 2.0);

	lastWidth = document.body.clientWidth;
	lastHeight = document.body.clientHeight;
	lastResizeTime = Date.now();

	updateBounds();
}

window.onresize = recenterCanvas;
function creditsForMerc() {
	window.location.href = "/credits";
	return;
}
function openPaint() {
	selectSound.play();

	if (!loggedIn) {
		return;
	}

	if (banned) {
		return;
	}

	if (mod) {
		painter.classList.add("open");
		const transform = instance.getTransform();
		const scale = transform.scale;

		if (scale < 20) {
			instance.smoothZoom(document.body.clientWidth / 2.0, document.body.clientHeight / 2.0, 20 / scale, duration = 2000, easing = "easeInOut");
		}
		return;

	}
}
function openPicker() {
	selectSound.play();

	if (!loggedIn) {
		window.location.href = "/auth/discord";
		return;
	}

	if (banned) {
		return;
	}

	if (mod) {
		picker.classList.add("open");
		const transform = instance.getTransform();
		const scale = transform.scale;

		if (scale < 20) {
			instance.smoothZoom(document.body.clientWidth / 2.0, document.body.clientHeight / 2.0, 20 / scale, duration = 2000, easing = "easeInOut");
		}
		return;

	}
	//modtools.classList.add("hidden")
	picker.classList.add("open");


	const transform = instance.getTransform();
	const scale = transform.scale;

	if (scale < 20) {
		instance.smoothZoom(document.body.clientWidth / 2.0, document.body.clientHeight / 2.0, 20 / scale, duration = 2000, easing = "easeInOut");
	}
}

function closePicker() {
	picker.classList.remove("open");
	cancelSound.play();
	unpickColor();
}



let selectedColor;

function pickColor(e) {
	unpickColor();
	selectedColor = e;

	e.classList.add("picked");

	if (cooldown <= 0) {
		confirm.classList.remove("inactive");
	}

	showSelectorPixel();

	pickSound.play();
}

function unpickColor() {
	if (selectedColor) {
		selectedColor.classList.remove("picked");
		selectedColor = null;
	}

	confirm.classList.add("inactive");

	showSelectorBorder();
}

const ctx = canvas.getContext("2d");
async function adminPlace() {
	if (!mod) {
		return;
	}

	const placedRes = await fetch("/adminPlace",
		{
			method: "POST",
			headers: new Headers({ "content-type": "application/json" }),
			body: JSON.stringify({ x: selectX, y: selectY, color: +selectedColor.dataset.color })
		});

	if (!placedRes.ok) {
		return reloadPage();
	}

	const placed = (await placedRes.json()).placed;

	if (!placed) {
		return errorSound.play();
	}



	placeSound.play();
	clearTimeout(cooldownInterval);

}
async function bulkPlace(x, y) {
	if (!mod) {
		return;
	}

	const placedRes = await fetch("/adminPlace",
		{
			method: "POST",
			headers: new Headers({ "content-type": "application/json" }),
			body: JSON.stringify({ x, y, color: +selectedColor.dataset.color })
		});

	if (!placedRes.ok) {
		return reloadPage();
	}

	const placed = (await placedRes.json()).placed;

	if (!placed) {
		return errorSound.play();
	}



	placeSound.play();
	clearTimeout(cooldownInterval);

}

function getSelectedPixels(startX, startY, endX, endY) {
	const selectedPixels = [];

	for (let x = startX; x <= endX; x++) {
		for (let y = startY; y <= endY; y++) {
			selectedPixels.push({ x, y });
		}
	}

	return selectedPixels;
}
let startX = null;
let startY = null;
let endX = null;
let endY = null;

console.log(startX, startY, endX, endY);

function handleSelect() {
	// Get the current position of the selector
	const transform = instance.getTransform();
	const centerX = (document.body.clientWidth / 2.0 - transform.x) / transform.scale;
	const centerY = (document.body.clientHeight / 2.0 - transform.y) / transform.scale;

	if (startX === null || startY === null) {
		// Set the start coordinates if they are not set
		startX = Math.floor(centerX);
		startY = Math.floor(centerY);
		console.log("Start Coords done")
		return;
	} else {
		// Set the end coordinates if start coordinates are already set
		endX = Math.floor(centerX);
		endY = Math.floor(centerY);
		console.log(startX, startY, endX, endY)

		const selectedPixels = getSelectedPixels(startX, startY, endX, endY);
		selectedPixels.forEach((pixel, index) => {
			processPixel(pixel, index);
		});
		startX = null;
		startY = null;
		endX = null;
		endY = null;
	}
}
function closePaint() {
	painter.classList.remove("open");
	cancelSound.play();
	unpickColor();
	startX = null;
	startY = null;
	endX = null;
	endY = null;

}
function toggleMap() {
	if (mappi.classList.contains("open")) {
		mappi.classList.remove("open");
		return;
	}
	mappi.classList.add("open");
}

function processPixel(pixel, index) {
	setTimeout(() => {
		console.log(`${pixel.x};${pixel.y}`);
		const x = pixel.x;
		const y = pixel.y;
		bulkPlace(x, y);
	}, index * 10); // Delay each pixel by 250 milliseconds (0.25 seconds)
}
async function placeColor() {
	if (!selectedColor || cooldown > 0) {
		return errorSound.play();
	}

	const placedRes = await fetch("/place",
		{
			method: "POST",
			headers: new Headers({ "content-type": "application/json" }),
			body: JSON.stringify({ x: selectX, y: selectY, color: +selectedColor.dataset.color })
		});

	if (!placedRes.ok) {
		return reloadPage();
	}

	const placed = (await placedRes.json()).placed;

	if (!placed) {
		return errorSound.play();
	}

	picker.classList.remove("open");

	placeSound.play();

	unpickColor();
	startCooldown(maxCooldown);
}

function showSelectorBorder() {
	selectorBorder.classList.remove("hidden");
	selectorPixel.classList.add("hidden");
}

function showSelectorPixel() {
	selectorBorder.classList.add("hidden");
	selectorPixel.classList.remove("hidden");
	pixelColor.style.backgroundColor = selectedColor.style.backgroundColor;
}



function convertTimer() {
	const date = new Date(0);
	date.setSeconds(cooldown);
	return timeString = date.toISOString().substring(14, 19);
}

let cooldownInterval;

function enableModMenu() {
	if (!loggedIn) {
		return;
	}

	if (banned) {
		return;
	}
	if (mod) {

	}
}

function updatePlaceButton() {
	if (!loggedIn) {
		placeButton.style.background = `linear-gradient(to left, #2C3C41, #2C3C41 100%, #566F74 100%, #566F74)`;
		placeText.innerHTML = "<b>Login to Place!</b>";
		return;
	}

	if (banned) {
		placeButton.style.background = `linear-gradient(to left, #2C3C41, #2C3C41 100%, #566F74 100%, #566F74)`;
		placeText.innerHTML = "<b>Restricted</b>";
		return;
	}

	if (mod) {
		placeButton.style.background = `linear-gradient(to left, #df61ff, #df61ff 100%, #566F74 100%, #566F74)`;
		placeText.innerHTML = "<b>Place</b>";
		const progress = 100 - cooldown / maxCooldown * 100;
		placeText.innerHTML = "<b>Place" + (cooldown > 0 ? ` in ${convertTimer()}` : "!") + "</b>";
		if (progress < 100) {
			placeButton.style.background = `linear-gradient(to right, #df61ff, #df61ff ${progress}%, #2C3C41 ${progress}%, #2C3C41)`;
			return;
		}
		modPlace.style.background = null
		return;
	}
	console.log(mod)

	const progress = 100 - cooldown / maxCooldown * 100;

	placeText.innerHTML = "<b>Place" + (cooldown > 0 ? ` in ${convertTimer()}` : "!") + "</b>";

	if (progress < 100) {
		placeButton.style.background = `linear-gradient(to right, #f76217, #f76217 ${progress}%, #2C3C41 ${progress}%, #2C3C41)`;
		return;
	}

	placeButton.style.background = null;

}

function startCooldown(newCooldown) {
	cooldown = newCooldown;
	updatePlaceButton();

	if (newCooldown === 0) {
		return;
	}

	setTimeout(stopCooldown, newCooldown * 1000);
	cooldownInterval = setInterval(() => {
		--cooldown;
		updatePlaceButton();
	}, 1000);
}

function stopCooldown() {
	cooldown = 0;
	updatePlaceButton();
	clearTimeout(cooldownInterval);

	if (picker.classList.contains("open") && selectedColor) {
		confirm.classList.remove("inactive");
	}

	refreshSound.play();
}

function shareUrl() {
	const transform = instance.getTransform();

	const url = new URL(window.location);
	url.searchParams.set("x", selectX);
	url.searchParams.set("y", selectY);
	url.searchParams.set("s", transform.scale.toFixed(transform.scale < 1 ? 1 : 0));

	const link = url.toString();

	if (window.isSecureContext && navigator.clipboard) {
		navigator.clipboard.writeText(link);
	}

	clearTimeout(shareTooltipTimer);

	shareTooltipTimer = setTimeout(() => {
		shareTooltip.classList.remove("visible");
	}, 1500);

	shareTooltip.classList.add("visible");

	clickSound.play();
}

function setAdminColors(colors) {
	adminColorsContainer.innerHTML = "";

	for (const color of colors) {
		const colorButton = document.createElement("div");

		colorButton.className = "adminColor";
		colorButton.dataset.color = color;
		colorButton.style.backgroundColor = rgbIntToHex(color);
		colorButton.onpointerup = () => pickColor(colorButton);

		adminColorsContainer.appendChild(colorButton);
	}
}
function setColors(colors) {
	colorsContainer.innerHTML = "";

	for (const color of colors) {
		const colorButton = document.createElement("div");

		colorButton.className = "color";
		colorButton.dataset.color = color;
		colorButton.style.backgroundColor = rgbIntToHex(color);
		colorButton.onpointerup = () => pickColor(colorButton);

		colorsContainer.appendChild(colorButton);
	}
}