module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["."],
          extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
          alias: {
            "@/hooks": "./lib/hooks",
            "@": ".",
            "@/app": "./app",
            "@/components": "./components",
            "@/context": "./context",
            "@/lib": "./lib",
            "@/navigation": "./navigation",
            "@/store": "./store",
            "@/types": "./types",
          },
        },
      ],
    ],
  };
};
