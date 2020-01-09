const {
	app,
	BrowserWindow,
	dialog,
	ipcMain
} = require('electron');

const WINDOW_TITLE = `Facial Recognition Photo Gallery v${process.env.npm_package_version}`;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;

function createWindow() {
	// Create the browser window.
	win = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			nodeIntegration: true
		},
		title: WINDOW_TITLE
	});

	win.setMenu(null);

	// and load the index.html of the app.
	win.loadFile('index.html');

	// Open the DevTools.
	// win.webContents.openDevTools();

	// Emitted when the window is closed.
	win.on('closed', () => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		win = null;
	});
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {

	const dataSetDirectory = dialog.showOpenDialogSync(win, {
		title: 'Select the data-set directory for build the database model',
		properties: ['openDirectory', 'multiSelections']
	});

	if (dataSetDirectory) {
		console.log(`Selected data-set directory: ${dataSetDirectory}`);
	} else {
		console.log(`Didn't select a data-set directory, using default directory ('./assets/data-set')`);
	}

	const photoDirectory = dialog.showOpenDialogSync(win, {
		title: 'Select the directory containing photos to view',
		properties: ['openDirectory']
	});

	if (photoDirectory) {
		console.log(`Selected directory: ${photoDirectory}`);
		createWindow();
	} else {
		console.log(`Didn't select a photo direction`);
		app.quit();
	}

	ipcMain.on('get-data-set-directory', event => {
		event.returnValue = dataSetDirectory;
	});

	ipcMain.on('get-photo-directory', (event) => {
		event.returnValue = photoDirectory;
	});

	ipcMain.on('get-window-title', event => {
		event.returnValue = WINDOW_TITLE;
	});
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
	// On macOS it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	// On macOS it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (win === null) {
		createWindow();
	}
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.