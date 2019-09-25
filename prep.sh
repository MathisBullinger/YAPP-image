if [[ $(cat node_modules/sharp/vendor/platform.json) != *"linux-x64"* ]]; then
  echo "Install Linux binaries"
  rm -rf node_modules/sharp
  npm install --arch=x64 --platform=linux --target=10.15.0 sharp
fi

echo "Copy Linux binaries"
mkdir -p .webpack/dependencies/node_modules && cp -rf node_modules/sharp .webpack/dependencies/node_modules/sharp
