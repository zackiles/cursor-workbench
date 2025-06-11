#!/bin/bash
npm run build:dev
/Applications/Visual\ Studio\ Code.app/Contents/MacOS/Electron --disable-extensions --extensionDevelopmentPath="$PWD" "$PWD"
