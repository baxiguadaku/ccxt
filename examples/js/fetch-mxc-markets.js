"use strict";

const ccxt = require ('../../ccxt');

(async function() {
    const mxc = new ccxt.mxc({apiKey: 'mx0rxVG5MD451BKsh1', secret: '3e2b4271b4f14435aa4a93996e991af6'});
    // const markets = await mxc.loadMarkets(true);
    // console.log(markets);

    // const balance = await mxc.fetchBalance();
    // console.log(balance);

    // const orderBook = await mxc.fetchOrderBook('BTC/USDT');
    // console.log(orderBook);

    // if (mxc.has.fetchOHLCV) {
    //     const fetchOHLCV = await mxc.fetchOHLCV('BTC/USDT', '5m', 1585123701000);
    //     console.log(fetchOHLCV);
    // }

    // if (mxc.has.fetchTicker) {
    //     const ticker = await mxc.fetchTicker('BTC/USDT');
    //     console.log(ticker);
    // }

    if (mxc.has.fetchTrades) {
        const trades = await mxc.fetchTrades('BTC/USDT');
        console.log(trades);
    }
})();
