'use strict';

// ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { ExchangeError, ArgumentsRequired } = require ('./base/errors');

// ---------------------------------------------------------------------------

module.exports = class mxc extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'mxc',
            'name': 'MXC',
            'countries': [ 'CN' ],
            'version': 'v1',
            'rateLimit': 1000,
            'has': {
                'CORS': false,
                'createMarketOrder': false,
                'fetchTickers': false,
                'withdraw': false,
                'fetchDeposits': false,
                'fetchWithdrawals': false,
                'fetchTransactions': false,
                'createDepositAddress': false,
                'fetchDepositAddress': false,
                'fetchClosedOrders': false,
                'fetchOHLCV': true,
                'fetchOpenOrders': false,
                'fetchOrderTrades': false,
                'fetchOrders': true,
                'fetchOrder': true,
                'fetchMyTrades': false,
            },
            'timeframes': {
                '1m': '1m',
                '5m': '5m',
                '15m': '15m',
                '30m': '30m',
                '60m': '60m',
                '1h': '1h',
                // '2h': '2h',
                // '4h': '4h',
                // '6h': '6h',
                // '12h': '12h',
                '1d': '1d',
                // '1w': '1w',
                '1M': '1M',
            },
            'urls': {
                'logo': '',
                'api': {
                    'public': 'http://47.75.103.134:9910/open/api/v2/',
                    'private': 'http://47.75.103.134:9910/open/api/v2/',
                },
                'www': 'https://mxc.ceo/',
                'doc': 'https://github.com/mxcdevelop/APIDoc',
                'fees': [
                    'https://www.mxc.ceo/info/fee',
                ],
                'referral': '',
            },
            'api': {
                'public': {
                    'get': [
                        'market/symbols',
                        'market/depth',
                        'market/kline',
                        'market/ticker',
                        'market/deals',
                    ],
                },
                'private': {
                    'get': [
                        'account/info',
                        'current/orders',
                        'orders',
                        'order',
                    ],
                    'post': [
                        'order',
                        'order_batch',
                        'order_cancel',
                    ],
                    'delete': [
                        'order',
                    ],
                },
            },
            'fees': {
                'trading': {
                    'tierBased': true,
                    'percentage': true,
                    'maker': 0.002,
                    'taker': 0.002,
                },
            },
            'exceptions': {
            },
            // https://gate.io/api2#errCode
            'errorCodeNames': {
            },
            'options': {
                'limits': {
                    'cost': {
                        'min': {
                            'BTC': 0.0001,
                            'ETH': 0.001,
                            'USDT': 1,
                        },
                    },
                },
            },
        });
    }

    async fetchMarkets (params = {}) {
        const response = await this.publicGetMarketSymbols (params);
        const markets = this.safeValue (response, 'data');
        if (!markets || markets.length < 1) {
            throw new ExchangeError (this.id + ' fetchMarkets got an unrecognized response');
        }
        const result = [];
        for (let i = 0; i < markets.length; i++) {
            const market = markets[i];
            const id = this.safeString (market, 'symbol');
            // all of their symbols are separated with an underscore
            // but not boe_eth_eth (BOE_ETH/ETH) which has two underscores
            // https://github.com/ccxt/ccxt/issues/4894
            const parts = id.split ('_');
            const numParts = parts.length;
            let baseId = parts[0];
            let quoteId = parts[1];
            if (numParts > 2) {
                baseId = parts[0] + '_' + parts[1];
                quoteId = parts[2];
            }
            const base = this.safeCurrencyCode (baseId);
            const quote = this.safeCurrencyCode (quoteId);
            const symbol = base + '/' + quote;
            const precision = {
                'amount': 8,
                'price': this.safeInteger (market, 'price_scale'),
            };
            const maker = this.safeFloat (market, 'maker_fee_rate');
            const taker = this.safeFloat (market, 'taker_fee_rate');
            const minAmount = this.safeFloat (market, 'min_amount');
            const maxAmount = this.safeFloat (market, 'max_amount');
            const minPrice = Math.pow (10, -this.safeInteger (market, 'price_scale'));
            const defaultCost = minAmount * minPrice;
            const minCost = this.safeFloat (this.options['limits']['cost']['min'], quote, defaultCost);
            const state = this.safeString (market, 'state');
            const active = state === 'ENABLED';
            result.push ({
                'id': id,
                'symbol': symbol,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'active': active,
                'maker': maker,
                'taker': taker,
                'precision': precision,
                'limits': {
                    'amount': {
                        'min': minAmount,
                        'max': maxAmount,
                    },
                    'price': {
                        'min': minPrice,
                        'max': undefined,
                    },
                    'cost': {
                        'min': minCost,
                        'max': undefined,
                    },
                },
                'info': market,
            });
        }
        return result;
    }

    async fetchBalance (params = {}) {
        await this.loadMarkets ();
        const response = await this.privateGetAccountInfo (params);
        const balances = this.safeValue (response, 'data');
        const result = { 'info': balances };
        const currencyIds = Object.keys (balances);
        for (let i = 0; i < currencyIds.length; i++) {
            const currencyId = currencyIds[i];
            const code = this.safeCurrencyCode (currencyId);
            const account = this.account ();
            if (code in balances) {
                account['free'] = this.safeFloat (balances[currencyId], 'available');
                account['used'] = this.safeFloat (balances[currencyId], 'frozen');
            }
            result[code] = account;
        }
        return this.parseBalance (result);
    }

    async fetchOrderBook (symbol, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'depth': limit || 5,
            'symbol': this.marketId (symbol),
        };
        const response = await this.publicGetMarketDepth (this.extend (request, params));
        const orderBook = this.safeValue (response, 'data');
        return this.parseOrderBook (orderBook, undefined, 'bids', 'asks', 'price', 'quantity');
    }

    parseOHLCV (ohlcv, market = undefined, timeframe = '1m', since = undefined, limit = undefined) {
        // they return [ Timestamp, Volume, Close, High, Low, Open ]
        return [
            parseInt (ohlcv[0] * 1000),   // t
            parseFloat (ohlcv[1]), // o
            parseFloat (ohlcv[3]), // h
            parseFloat (ohlcv[4]), // l
            parseFloat (ohlcv[2]), // c
            parseFloat (ohlcv[5]), // v
        ];
    }

    async fetchOHLCV (symbol, timeframe = '1m', since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'symbol': this.marketId (symbol),
            'interval': this.timeframes[timeframe],
            'start_time': this.seconds (),
        };
        // max limit = 1000
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        if (since !== undefined) {
            request['start_time'] = parseInt (since / 1000);
        }
        const response = await this.publicGetMarketKline (this.extend (request, params));
        //        ordering: Ts, O, C, H, L, V
        //     {
        //         "code": 200,
        //         "data": [
        //             [ "TS", "o", "c", "h", "l", "v" ],
        //         ]
        //     }
        //
        const data = this.safeValue (response, 'data', []);
        return this.parseOHLCVs (data, market, timeframe, since, limit);
    }

    parseTicker (ticker, market = undefined) {
        let symbol = undefined;
        if (market) {
            symbol = market['symbol'];
        }
        const timestamp = this.safeInteger (ticker, 'time');
        const open = this.safeFloat (ticker, 'open');
        const last = this.safeFloat (ticker, 'last');
        let change = undefined;
        let average = undefined;
        let percentage = undefined;
        if ((open !== undefined) && (last !== undefined)) {
            change = last - open;
            average = this.sum (open, last) / 2;
            if ((last !== undefined) && (last > 0)) {
                percentage = (change / open) * 100;
            }
        }
        return {
            'symbol': symbol,
            'info': ticker,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'high': this.safeFloat (ticker, 'high'),
            'low': this.safeFloat (ticker, 'low'),
            'bid': this.safeFloat (ticker, 'bid'),
            'bidVolume': undefined,
            'ask': this.safeFloat (ticker, 'ask'),
            'askVolume': undefined,
            'vwap': undefined,
            'open': open,
            'close': last,
            'last': last,
            'previousClose': undefined,
            'change': change,
            'percentage': percentage,
            'average': average,
            'baseVolume': this.safeFloat (ticker, 'volume'), // gateio has them reversed
            'quoteVolume': undefined,
        };
    }

    // async fetchTickers (symbols = undefined, params = {}) {
    //     await this.loadMarkets ();
    //     const response = await this.publicGetMarketTicker (params);
    //     const result = {};
    //     const data = this.safeValue (response, 'data', []);
    //     const ids = Object.keys (data);
    //     for (let i = 0; i < ids.length; i++) {
    //         const id = ids[i];
    //         const [ baseId, quoteId ] = id.split ('_');
    //         let base = baseId.toUpperCase ();
    //         let quote = quoteId.toUpperCase ();
    //         base = this.safeCurrencyCode (base);
    //         quote = this.safeCurrencyCode (quote);
    //         const symbol = base + '/' + quote;
    //         let market = undefined;
    //         if (symbol in this.markets) {
    //             market = this.markets[symbol];
    //         }
    //         if (id in this.markets_by_id) {
    //             market = this.markets_by_id[id];
    //         }
    //         result[symbol] = this.parseTicker (data[id], market);
    //     }
    //     return result;
    // }

    async fetchTicker (symbol, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'symbol': this.marketId (symbol),
        };
        const response = await this.publicGetMarketTicker (this.extend (request, params));
        const ticker = this.safeValue (response, 'data', [])[0];
        return this.parseTicker (ticker, market);
    }

    parseTrade (trade, market = undefined) {
        const timestamp = this.safeInteger (trade, 'trade_time');
        let symbol = undefined;
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        // take either of orderid or orderId
        const type = this.safeString (trade, 'trade_type');
        const price = this.safeFloat (trade, 'trade_price');
        const amount = this.safeFloat (trade, 'trade_quantity');
        let cost = undefined;
        if (price !== undefined && amount !== undefined) {
            cost = price * amount;
        }
        return {
            'info': trade,
            'id': undefined,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'order': undefined,
            'type': undefined,
            'side': type === 'BID' ? 'buy' : 'sell',
            'takerOrMaker': undefined,
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': undefined,
        };
    }

    async fetchTrades (symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'symbol': this.marketId (symbol),
        };
        // max limit = 1000
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        const response = await this.publicGetMarketDeals (this.extend (request, params));
        const data = this.safeValue (response, 'data');
        return this.parseTrades (data, market, since, limit);
    }

    async fetchOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        const request = {
            'api_key': this.apiKey,
            'req_time': this.milliseconds (),
        };
        const response = await this.privateGetCurrentOrders (this.extend (request, params));
        return this.parseOrders (response['data'], undefined, since, limit);
    }

    async fetchOrder (id, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'trade_no': id,
            'market': this.marketId (symbol),
            'api_key': this.apiKey,
            'req_time': this.milliseconds (),
        };
        const response = await this.privateGetOrder (this.extend (request, params));
        return this.parseOrder (response['data']);
    }

    parseOrderSide (side) {
        const sides = {
            '1': 'buy',
            '2': 'sell',
        };
        return this.safeString (sides, side, side);
    }

    parseOrderStatus (status) {
        const statuses = {
            '1': 'open',
            '2': 'closed',
            '3': 'open', // partial closed
            '4': 'canceled', // partial closed
            '5': 'canceled', // partial canceled
        };
        return this.safeString (statuses, status, status);
    }

    parseOrder (order, market = undefined) {
        // Different API endpoints returns order info in different format...
        // with different fields filled.
        let id = this.safeString (order, 'id');
        if (id === undefined) {
            id = this.safeString (order, 'data');
        }
        let symbol = undefined;
        const marketId = this.safeString (order, 'market');
        if (marketId in this.markets_by_id) {
            market = this.markets_by_id[marketId];
        }
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        const dateStr = this.safeString (order, 'createTime');
        // XXX: MXC returns order creation times in GMT+8 timezone with out specifying it
        //  hence appending ' GMT+8' to it so we can get the correct value
        // XXX: Also MXC api does not return actual matched prices and costs/fees
        let timestamp = undefined;
        if (dateStr !== undefined) {
            timestamp = this.parseDate (dateStr + '  GMT+8');
        }
        const status = this.parseOrderStatus (this.safeString (order, 'status'));
        const side = this.parseOrderSide (this.safeString (order, 'type'));
        const price = this.safeFloat (order, 'price');
        let amount = this.safeFloat (order, 'totalQuantity');
        if (amount === undefined) {
            amount = this.safeFloat (order, 'initialAmount');
        }
        const filled = this.safeFloat (order, 'tradedQuantity');
        const average = undefined;
        let remaining = undefined;
        if ((filled !== undefined) && (amount !== undefined)) {
            remaining = amount - filled;
        }
        return {
            'id': id,
            'datetime': this.iso8601 (timestamp),
            'timestamp': timestamp,
            'status': status,
            'symbol': symbol,
            'type': 'limit',
            'side': side,
            'price': price,
            'cost': undefined,
            'amount': amount,
            'filled': filled,
            'remaining': remaining,
            'average': average,
            'trades': undefined,
            'fee': {
                'cost': undefined,
                'currency': undefined,
                'rate': undefined,
            },
            'info': order,
        };
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        if (type === 'market') {
            throw new ExchangeError (this.id + ' allows limit orders only');
        }
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'api_key': this.apiKey,
            'req_time': this.milliseconds (),
            'market': this.marketId (symbol),
            'price': price,
            'quantity': amount,
            'trade_type': (side === 'buy') ? '1' : '2',
        };
        const response = await this.privatePostOrder (this.extend (request, params));
        return this.parseOrder (this.extend ({
            'status': 'open',
            'type': side,
            'initialAmount': amount,
        }, response), market);
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        if (symbol === undefined) {
            throw new ArgumentsRequired (this.id + ' cancelOrder requires symbol argument');
        }
        await this.loadMarkets ();
        const request = {
            'api_key': this.apiKey,
            'req_time': this.milliseconds (),
            'market': this.marketId (symbol),
            'trade_no': id,
        };
        return await this.privateDeleteOrder (this.extend (request, params));
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.urls['api'][api] + this.implodeParams (path, params);
        const query = this.omit (params, this.extractParams (path));
        let request = {
            'api_key': this.apiKey,
        };
        if (api === 'public') {
            request = this.extend (request, query);
            if (Object.keys (request).length) {
                url += '?' + this.urlencode (request);
            }
        } else {
            this.checkRequiredCredentials ();
            request.req_time = this.seconds ();
            if ('recv_window' in params) {
                request.recv_window = params.recv_window;
            }
            if (method !== 'POST') {
                request = this.extend (request, query);
            }
            request = this.keysort (request);
            const auth = this.urlencode (request);
            const signature = this.hmac (this.encode ([ method, `/open/api/v2/${path}`, auth ].join ('\n')), this.encode (this.secret), 'sha256');
            const suffix = 'sign=' + signature;
            url += '?' + auth + '&' + suffix;
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    handleErrors (code, reason, url, method, headers, body, response, requestHeaders, requestBody) {
        if (response === undefined) {
            return;
        }
        const resultString = this.safeString (response, 'result', '');
        if (resultString !== 'false') {
            return;
        }
        const errorCode = this.safeString (response, 'code');
        const message = this.safeString (response, 'message', body);
        if (errorCode !== undefined) {
            const feedback = this.safeString (this.errorCodeNames, errorCode, message);
            this.throwExactlyMatchedException (this.exceptions['exact'], errorCode, feedback);
        }
    }
};
