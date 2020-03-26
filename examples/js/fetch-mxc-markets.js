"use strict";

const ccxt = require ('../../ccxt');

(async function() {
    const mxc = new ccxt.mxc({apiKey: 'mx0rxVG5MD451BKsh1', secret: '3e2b4271b4f14435aa4a93996e991af6'});
    const markets = await mxc.loadMarkets(true);
    console.log(markets);

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

    // if (mxc.has.fetchTrades) {
    //     const trades = await mxc.fetchTrades('BTC/USDT');
    //     console.log(trades);
    // }

    // if (mxc.has.fetchOrder) {
    //     const order = await mxc.fetchOrder('a5a8633e709f4e39814cbb755fca0825');
    //     console.log(order);
    // }

    // if (mxc.has.fetchOrders) {
    //     const orders = await mxc.fetchOrders('TRX/ETH');
    //     console.log(orders);
    // }

    // if (mxc.has.fetchOpenOrders) {
    //     const orders = await mxc.fetchOpenOrders('TRX/ETH');
    //     console.log(orders);
    // }

    // if (mxc.has.fetchClosedOrders) {
    //     const orders = await mxc.fetchClosedOrders('TRX/ETH');
    //     console.log(orders);
    // }

    // if (mxc.has.createOrder) {
    //     const order = await mxc.createOrder('ETH/USDT', 'limit', 'sell', 10, 136);
    //     console.log(order);
    // }

    // if (mxc.has.cancelOrder) {
    //     const order = await mxc.cancelOrder('b4302669840d456baa3a15e7c21496bb');
    //     console.log(order);
    // }

    // if (mxc.has.fetchMyTrades) {
    //     const myTrades = await mxc.fetchMyTrades('ETH/USDT');
    //     console.log(myTrades);
    // }
})();
