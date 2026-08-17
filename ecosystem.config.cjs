module.exports = {
  apps: [
    {
      name: "bdo-node-ranks",
      script: "dist-server/src/server/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
        MARKET_PROVIDER: "bdolytics-arsha",
        BDO_MARKET_REGION: "ASIA",
        BDOLYTICS_BASE_URL: "https://bdolytics.com",
        ARSHA_BASE_URL: "https://api.arsha.io"
      }
    }
  ]
};
