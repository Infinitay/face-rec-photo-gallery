const fs = require('fs');
const readline = require('readline');
const {
	google
} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const TOKEN_PATH = './assets/google/token.json';
const OAUTH = require('./assets/google/oauth2-config.json');

const oauth2Client = new google.auth.OAuth2(
	OAUTH.clientId,
	OAUTH.secret,
	OAUTH.redirect
);

// getAccessToken(oauth2Client, scrape);

fs.readFile('./assets/google/credentials.json', (err, content) => {
	if (err) return console.log('Error loading client secret file:', err);
	// Authorize a client with credentials, then call the Google Drive API.
	// authorize(JSON.parse(content), scrapeDrive);
	authorize(JSON.parse(content), scrapeSheet)
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
	const {
		client_secret,
		client_id,
		redirect_uris
	} = credentials.installed;
	const oAuth2Client = new google.auth.OAuth2(
		client_id, client_secret, redirect_uris[0]);

	// Check if we have previously stored a token.
	fs.readFile(TOKEN_PATH, (err, token) => {
		if (err) return getAccessToken(oAuth2Client, callback);
		oAuth2Client.setCredentials(JSON.parse(token));
		callback(oAuth2Client);
	});
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
async function getAccessToken(oAuth2Client, callback) {
	const authUrl = oAuth2Client.generateAuthUrl({
		access_type: 'offline',
		scope: SCOPES,
	});
	console.log('Authorize this app by visiting this url:', authUrl);
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	await rl.question('Enter the code from that page here: ', (code) => {
		rl.close();
		oAuth2Client.getToken(code, (err, token) => {
			if (err) return console.error('Error retrieving access token', err);
			oAuth2Client.setCredentials(token);
			// Store the token to disk for later program executions
			fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
				if (err) return console.error(err);
				console.log('Token stored to', TOKEN_PATH);
			});
			callback(oAuth2Client);
		});
	});
}


async function scrapeDrive(auth) {
	const drive = google.drive({
		version: 'v3',
		auth: auth,
	});
	let parseFiles = [];
	let files = [];

	let res = await drive.files.list({
		// q: `'1s4QGfIgFXetVA9LExwjilSdTY4ysqC36' in parents and mimeType = 'application/vnd.google-apps.folder'`,
		q: `'1Tri2ajaUm4YksE84sqEqmMChUSCJpKU7' in parents and (name contains 'Gimpo' or name contains 'GMP') and (name contains 'Incheon' or name contains 'ICN')`
	});
	log(res.data);
	/* parseFiles = res.data.files.map(folder => folder.id);
	for (let nestedFolder of parseFiles) {
		let nestedRes = await drive.files.list({
			q: `'${nestedFolder}' in parents and mimeType contains 'image/'`
		});
		console.log(nestedRes.data);
	} */
}

async function scrapeSheet(auth) {
	const sheetsApi = google.sheets({
		version: 'v4',
		auth: auth,
	});

	const spreadsheetIds = ['1ZJw_TcUnMVDfcYo6SRssM-zCmFUiUAM2XfCLl6oj5rc', '128qKdqfKLLSWN8YBQTDRsTNPK1WEugN5cAz1hyRVTj8'];
	for (const spreadsheetId of spreadsheetIds) {
		let res = await sheetsApi.spreadsheets.get({
			spreadsheetId: spreadsheetId,
		});
		log(`Scrapping through ${res.data.properties.title} spreadsheet...`);
		let sheets = res.data.sheets.map(sheet => {
			return {
				'sheetId': sheet.properties.sheetId,
				'title': sheet.properties.title.trim(),
				'rows': sheet.properties.gridProperties.rowCount,
				'columns': sheet.properties.gridProperties.columnCount,
			}
		});
		// log(sheets);

		const scrapped = [];
		for (let sheet of sheets) {
			// Everything starts at 1, Col 1 = A, Row 1 = 1
			res = await sheetsApi.spreadsheets.values.get({
				spreadsheetId: spreadsheetId,
				range: `${sheet.title}!A:${toLetter(sheet.columns)}`
			});
			const hits = [];
			const indexes = getIndexes(res.data.values.shift()); // #shift removes 1st element from array and returns it
			if (indexes) {
				for (const row of res.data.values.filter(row => row.length)) {
					if (row[indexes.event].match(/GMP|Gimpo|Incheon|ICN/gi) != null) {
						hits.push({
							date: row[indexes.date].trim(),
							event: row[indexes.event].trim(),
							link: row[indexes.link].trim()
						});
					}
				}
				scrapped.push({
					'name': sheet.title,
					'data': hits
				});
			}
		}

		for (const idol of scrapped) {
			log(`${idol.data.length} events to parse for ${idol.name}.`);
		}
	}
}

// https://stackoverflow.com/a/53678158/7835042
function toLetter(n) {
	n = n - 1; // Makes it so that everything starts at 1, since Google Sheets row and col start at 1
	return (a = Math.floor(n / 26)) >= 0 ? toLetter(a - 1) + String.fromCharCode(65 + (n % 26)) : '';
}

function getIndexes(row) {
	const indexes = {};
	for (const cell in row) {
		// Change to if statements and use regex in the future in case of more mistakes
		switch (row[cell].toLowerCase().trim()) {
			case 'date':
				indexes.date = cell;
				break;
			case 'event':
				indexes.event = cell;
				break;
			case 'link':
				indexes.link = cell;
				break;
			default:
				break;
		}
	}
	return Object.keys(indexes).length == 3 ? indexes : undefined;
}

function log(msg) {
	console.log(`[${new Date().toLocaleString()}] ${msg}`);
}