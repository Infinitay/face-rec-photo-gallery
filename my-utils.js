const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const util = require('util');
const pipeline = util.promisify(require('stream').pipeline);
const bigJson = require('big-json');

function getLastModifiedDateSync(_path) {
	return fs.statSync(_path).mtimeMs;
}

function getNestedLastModifiedDateSync(_path) {
	let lastModified = 0;
	const dirs = fs.readdirSync(_path, {
		withFileTypes: true
	}).filter(dirent => dirent.isDirectory()).map(dirent => dirent.name);
	for (let dir of dirs) {
		const tempLastModified = getLastModifiedDateSync(path.join(_path, dir));
		lastModified = lastModified < tempLastModified ? tempLastModified : lastModified;
	}
	return lastModified;
}

async function compressDatabaseFromFile() {
	return pipeline(fs.createReadStream('./assets/LBF Database.json'), zlib.createGzip(), fs.createWriteStream('./assets/LBF Database.json.gz'));
}

async function compressDatabaseFromJSON(jsonDB) {
	return pipeline(bigJson.createStringifyStream({
		body: jsonDB
	}), zlib.createGzip(), fs.createWriteStream('./assets/LBF Database.json.gz'));
}

async function decompressDatabaseToJSON() {
	const chunks = [];
	const stream = fs.createReadStream('./assets/LBF Database.json.gz').pipe(zlib.createGunzip()).on('data', chunk => {
		chunks.push(chunk);
	});
	return new Promise((res) => {
		stream.on('end', () => {
			res(JSON.parse(Buffer.concat(chunks).toString()));
		});
	});
}

async function writeDecompressedDatabase() {
	return pipeline(fs.createReadStream('./assets/LBF Database.json.gz'), zlib.createGunzip(), fs.createWriteStream('./assets/LBF Database.json'));
}

module.exports = {
	getLastModifiedDateSync: getLastModifiedDateSync,
	getNestedLastModifiedDateSync: getNestedLastModifiedDateSync,
	compressDatabaseFromFile: compressDatabaseFromFile,
	compressDatabaseFromJSON: compressDatabaseFromJSON,
	decompressDatabaseToJSON: decompressDatabaseToJSON,
	writeDecompressedDatabase: writeDecompressedDatabase
};