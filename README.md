# tdm-js

JavaScript class to simplify the communication with a Thymio II robot from a web app via the TDM.

The class `TDM` is implemented in JavaScript in [thymio/index.js](thymio/index.js). It's compiled with [thymio.ts](https://github.com/Mobsya/aseba/tree/master/js/src/thymio.ts) by [WebPack](https://webpack.js.org/) to make a single file, `thymio/thymio.js`. This file can be imported directly in web apps in a single `<script src="thymio.js"></script>` element without any other dependency. See the comments at the beginning of [index.js](thymio/index.js). Communication between the web app and the TDM is done with a websocket.

For more informations about `thymio.ts`, see [github.com/Mobsya/thymio-js-api-demo](https://github.com/Mobsya/thymio-js-api-demo).

The TDM, or Thymio Device Manager, is the background program which handles the communication between other programs and Thymio robots. It's a part of [Thymio Suite](https://www.thymio.org/products/programming-with-thymio-suite/). Its source code is in [github.com/Mobsya/aseba](https://github.com/Mobsya/aseba). It can also be installed without Thymio Suite; see [github.com/Mobsya/tdm-launcher/releases](https://github.com/Mobsya/tdm-launcher/releases).

`index.js` was first developed for VPL 3, whose source code is in [github.com/epfl-mobots/vpl-web](https://github.com/epfl-mobots/vpl-web).

## Patching the JavaScript TDM API

As per version 0.11.1 of the [JavaScript TDM API](https://www.npmjs.com/package/@mobsya-association/thymio-api), the value thrown on compilation error is the error message as a string. To get the error location in the source code, you can patch the API by running `patch-thymio-api` _after running `npm i`_. In `thymio-api/dist/thymio.js`, it will replace `msg.message()` with
```
{"message":msg.message(),"line":msg.line(),"column":msg.column()}
```
It's this object which is passed to the function `options.failure` if you set it, instead of only the error message before.
