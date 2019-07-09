# **face-api.js Testing Project**

This is a *testing* project for facial recognition using [face-api.js](https://github.com/justadudewhohacks/face-api.js). This is my first project using nodejs and electron as I am not too familiar with JS or HTML, so excuse the *bad code*.

I had troubles initially getting everything to run properly because [canvas](https://www.npmjs.com/package/canvas) was not cooperating with electron on my end. I will include a list of problems that arose for me and the solutions I took. First, please follow the installation instructions for [node-canvas](https://www.npmjs.com/package/canvas).


# Instructions

~~~~
npm i
npm start
~~~~

A folder dialog will appear prompting you to select the folder which you want to view the contents of as well as run the facial recognition against.

In order to change the database of the facial recognition, or *training data* if you will, you have to manually change that yourself over at `assets/test-data-set`.

# Troubleshooting

If you get an error involving node-canvas and different node version such as

> Uncaught Error: The module '\Face-API\node_modules\canvas\build\Release\canvas.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 72. This version of Node.js requires NODE_MODULE_VERSION 70. Please try re-compiling or re-installing the module (for instance, using `npm rebuild` or `npm install`).

## Canvas Solution

Follow instructions for [electron-rebuild](https://electronjs.org/docs/tutorial/using-native-node-modules). For me, since I am on windows, I ran the following  `./node_modules/.bin/electron-rebuild`.

#

After I solved that issue I came across another issue regarding `tfjs`.

>Initialization of backend tensorflow failed
>
>Error: The specified module could not be found.
>\node_modules\@tensorflow\tfjs-node\build\Release\tfjs_binding.node

## TFJS Solution
All I did was rebuild the project with `npm rebuild` which resolved this error for me.