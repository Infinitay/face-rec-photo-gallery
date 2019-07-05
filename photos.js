const fs = require('fs');
const path = require('path');

const imageReg = /[/.](gif|jpg|jpeg|tiff|png)$/i;

module.exports = {
	getPhotos: getPhotos,
};

function getPhotos(dir) {
	console.log(`Passed dir: ${dir}`);
	const photos = [];
	console.log(dir);
	for (const photo of fs.readdirSync(dir.toString())) {
		const photoPath = path.parse(path.join(dir.toString(), photo));
		if (imageReg.test(photoPath.ext)) {
			photos.push(photoPath);
		}
	}
	return photos;
}