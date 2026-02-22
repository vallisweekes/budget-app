module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./src"],
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
          alias: {
            "@": "./src",
            "@/screens": "./src/screens",
            "@/components": "./src/components",
            "@/context": "./src/context",
            "@/lib": "./src/lib",
            "@/navigation": "./src/navigation",
            "@/store": "./src/store",
          },
        },
      ],
    ],
  };
};
