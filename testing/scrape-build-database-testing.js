const tf = require('@tensorflow/tfjs-node-gpu');
const canvas = require('canvas');
const faceapi = require('face-api.js');
const gst = require('./google-scraping-testing.js');

const {
	Canvas,
	Image,
	ImageData,
	Video
} = canvas;
faceapi.env.monkeyPatch({
	Canvas,
	Image,
	ImageData,
	Video
});

const {
	google
} = require('googleapis');

(async () => {
	let auth = gst.auth();
	console.log(auth ? 'Got auth successfully' : 'Failed to get auth');
	await faceapi.nets.ssdMobilenetv1.loadFromDisk('./assets/models');
	console.log('Loaded model');
	const drive = google.drive({
		version: 'v3',
		auth: auth
	});

	let res = await drive.files.list({
		q: `'1ESHQYeRfMcUaFCxSgPkePy9eXGtzV9QN' in parents and mimeType contains 'image/'`
	});
	// log(JSON.stringify(res.data, null, 4));
	let file = res.data.files[0];

	file = await getFileAsBuffer(drive, file);
	console.log(`File: ${file}`);
	let img = await canvas.loadImage(file);
	console.log(`Image: ${img}`);
	let detection = await faceapi.detectSingleFace(img);
	console.log(detection);
})();


// https://stackoverflow.com/a/57813752/7835042
/*
 * If you don't want to use a direct URL, if even available bc Google, you can
 * use canvas#loadImage by passing in a Buffer containing the image itself.
 * To do so, you need to stream the file (responseType), gather all chunks of data,
 * concat the chunks into one Buffer, and return.
 */
async function getFileAsBuffer(drive, file) {
	return new Promise(resolve => {
		drive.files.get({
			fileId: file.id,
			alt: "media"
		}, {
			responseType: "stream"
		}, (err, {
			data
		}) => {
			if (err) {
				return console.error("The API returned an error: " + err);
			} else {
				let buf = [];
				data.on("data", function (e) {
					buf.push(e);
				});
				data.on("end", function () {
					const buffer = Buffer.concat(buf);
					console.log(buffer);
					resolve(buffer);
				});
			}
		});
	});
}