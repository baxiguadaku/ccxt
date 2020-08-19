'use strict';

// ---------------------------------------------------------------------------

const Exchange = require ('./base/Exchange');
const { ExchangeError, InvalidOrder } = require ('./base/errors');

// ---------------------------------------------------------------------------

module.exports = class mxc extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'mxc',
            'name': 'MXC',
            'countries': [ 'CN' ],
            'version': 'v2',
            'rateLimit': 1000,
            'hostname': 'www.mxc.com',
            // 'hostname': 'mapi.mxck.top', // test
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
                'fetchClosedOrders': true,
                'fetchOHLCV': true,
                'fetchOpenOrders': true,
                'fetchOrderTrades': false,
                'fetchOrders': true,
                'fetchOrder': true,
                'fetchMyTrades': true,
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
                'api': 'https://{hostname}',
                // 'api': 'http://{hostname}', // test
                'www': 'https://mxc.com/',
                'doc': 'https://mxcdevelop.github.io/APIDoc/',
                'fees': [
                    'https://www.mxc.com/info/fee',
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
                        'order/list',
                        'order/query',
                        'order/deals',
                    ],
                    'post': [
                        'order/place',
                    ],
                    'delete': [
                        'order/cancel',
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
                'exact': {
                    '30002': InvalidOrder,
                },
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
                'amount': this.safeInteger (market, 'quantity_scale'),
                'price': this.safeInteger (market, 'price_scale'),
                'cost': 8,
            };
            const maker = this.safeFloat (market, 'maker_fee_rate');
            const taker = this.safeFloat (market, 'taker_fee_rate');
            const minAmount = this.safeFloat (market, 'min_amount');
            const maxAmount = this.safeFloat (market, 'max_amount');
            const minQuantity = Math.pow (10, -this.safeInteger (market, 'quantity_scale'));
            const minPrice = Math.pow (10, -this.safeInteger (market, 'price_scale'));
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
                        'min': minQuantity,
                        'max': undefined,
                    },
                    'price': {
                        'min': minPrice,
                        'max': undefined,
                    },
                    'cost': {
                        'min': minAmount,
                        'max': maxAmount,
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
        const timestamp = this.safeInteger2 (trade, 'create_time', 'trade_time');
        let symbol = undefined;
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        // take either of orderid or orderId
        const id = this.safeString (trade, 'order_id');
        const side = this.safeString (trade, 'trade_type');
        const isTaker = this.safeValue (trade, 'is_taker');
        const price = this.safeFloat2 (trade, 'price', 'trade_price');
        const amount = this.safeFloat2 (trade, 'quantity', 'trade_quantity');
        let cost = undefined;
        if (price !== undefined && amount !== undefined) {
            cost = price * amount;
        }
        const feeCost = this.safeFloat (trade, 'fee');
        const feeCurrency = this.safeString (trade, 'fee_currency');
        let fee = undefined;
        if ((feeCost !== undefined) && (feeCurrency !== undefined)) {
            fee = {
                'cost': feeCost,
                'currency': feeCurrency,
                'rate': undefined,
            };
        }
        return {
            'info': trade,
            'id': id,
            'timestamp': timestamp,
            'datetime': this.iso8601 (timestamp),
            'symbol': symbol,
            'order': id,
            'type': 'limit',
            'side': side === 'BID' ? 'buy' : 'sell',
            'takerOrMaker': isTaker ? 'taker' : 'maker',
            'price': price,
            'amount': amount,
            'cost': cost,
            'fee': fee,
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

    parseOrderSide (side) {
        const sides = {
            'BID': 'buy',
            'ASK': 'sell',
        };
        return this.safeString (sides, side, side);
    }

    parseOrderStatus (status) {
        const statuses = {
            'NEW': 'open',
            'FILLED': 'closed',
            'PARTIALLY_FILLED': 'open', // partial closed
            'CANCELED': 'canceled',
            'PARTIALLY_CANCELED': 'canceled', // partial canceled
        };
        return this.safeString (statuses, status, status);
    }

    // parseOrderType (type) {
    //     const types = {
    //         'LIMIT_ORDER': 'limit',
    //         'POST_ONLY': 'limit',
    //     };
    //     return this.safeString (types, type, type);
    // }

    parseOrder (order, market = undefined) {
        // Different API endpoints returns order info in different format...
        // with different fields filled.
        const id = this.safeString (order, 'id');
        const timestamp = this.safeInteger (order, 'create_time');
        const status = this.parseOrderStatus (this.safeString (order, 'state'));
        let symbol = undefined;
        const marketId = this.safeString (order, 'symbol');
        if (marketId in this.markets_by_id) {
            market = this.markets_by_id[marketId];
        }
        if (market !== undefined) {
            symbol = market['symbol'];
        }
        const side = this.parseOrderSide (this.safeString (order, 'type'));
        const price = this.safeFloat (order, 'price');
        const amount = this.safeFloat (order, 'quantity');
        const filled = this.safeFloat (order, 'deal_quantity');
        const cost = this.safeFloat (order, 'deal_amount');
        let remaining = undefined;
        let average = undefined;
        if (filled !== undefined) {
            if (amount !== undefined) {
                remaining = amount - filled;
            }
            if ((cost !== undefined) && (filled > 0)) {
                average = cost / filled;
            }
        }
        return {
            'id': id,
            'datetime': this.iso8601 (timestamp),
            'timestamp': timestamp,
            'lastTradeTimestamp': undefined,
            'status': status,
            'symbol': symbol,
            'type': 'limit',
            'side': side,
            'price': price,
            'amount': amount,
            'filled': filled,
            'remaining': remaining,
            'cost': cost,
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

    async fetchOrder (id, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'order_ids': id,
        };
        const response = await this.privateGetOrderQuery (this.extend (request, params));
        const data = this.safeValue (response, 'data', []);
        return this.parseOrder (data[0]);
    }

    async fetchOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'symbol': this.marketId (symbol),
            'start_time': this.seconds (),
        };
        // max limit = 1000
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        if (since !== undefined) {
            request['start_time'] = parseInt (since / 1000);
        }
        const response = await this.privateGetOrderList (this.extend (request, params));
        const data = this.safeValue (response, 'data');
        return this.parseOrders (data, undefined, since, limit);
    }

    async fetchOpenOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        const request = {
            'states': 'NEW,PARTIALLY_FILLED',
        };
        return await this.fetchOrders (symbol, since, limit, this.extend (request, params));
    }

    async fetchClosedOrders (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        const request = {
            'states': 'FILLED',
        };
        return await this.fetchOrders (symbol, since, limit, this.extend (request, params));
    }

    async createOrder (symbol, type, side, amount, price = undefined, params = {}) {
        if (type === 'market') {
            throw new ExchangeError (this.id + ' allows limit orders only');
        }
        await this.loadMarkets ();
        const request = {
            'symbol': this.marketId (symbol),
            'price': price,
            'quantity': amount,
            'trade_type': (side === 'buy') ? 'BID' : 'ASK',
        };
        if (type === 'limit') {
            request.order_type = 'LIMIT_ORDER';
        }
        const response = await this.privatePostOrderPlace (this.extend (request, params));
        const id = this.safeString (response, 'data');
        const timestamp = this.milliseconds ();
        const order = {
            'symbol': this.marketId (symbol),
            'id': id,
            'price': price,
            'quantity': amount,
            'create_time': timestamp,
            'state': 'NEW',
            'type': request.trade_type,
        };
        return this.parseOrder (order);
    }

    async cancelOrder (id, symbol = undefined, params = {}) {
        await this.loadMarkets ();
        const request = {
            'order_ids': id,
        };
        const response = await this.privateDeleteOrderCancel (this.extend (request, params));
        const data = this.safeValue (response, 'data');
        const order = {
            'id': id,
            'state': 'CANCELED',
            'info': data,
        };
        return this.parseOrder (order);
    }

    async fetchMyTrades (symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const request = {
            'symbol': this.marketId (symbol),
        };
        // max limit = 1000
        if (limit !== undefined) {
            request['limit'] = limit;
        }
        if (since !== undefined) {
            request['start_time'] = parseInt (since / 1000);
        }
        const response = await this.privateGetOrderDeals (this.extend (request, params));
        const data = this.safeValue (response, 'data');
        return this.parseTrades (data, market, since, limit);
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        const path1 = `/open/api/${this.version}/`;
        const origin = this.urls['api'];
        let url = this.implodeParams (origin, this.extend ({ 'hostname': this.hostname }, params)) + path1 + this.implodeParams (path, params);
        const query = this.omit (params, this.extractParams (path), this.extractParams (origin));
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
            const signature = this.hmac (this.encode ([ method, `${path1}${path}`, auth ].join ('\n')), this.encode (this.secret), 'sha256');
            const suffix = 'sign=' + signature;
            url += '?' + auth + '&' + suffix;
            if (method === 'POST') {
                body = this.json (query);
                headers = {
                    'Content-Type': 'application/json',
                };
            } else {
                headers = {
                    'Content-Type': 'application/x-www-form-urlencoded',
                };
            }
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }

    handleErrors (code, reason, url, method, headers, body, response, requestHeaders, requestBody) {
        if (response === undefined) {
            return;
        }
        if (code >= 400) {
            const errorCode = this.safeString (response, 'code');
            const message = this.safeString (response, 'msg', body);
            if (errorCode !== undefined) {
                const feedback = this.id + ' ' + message;
                this.throwExactlyMatchedException (this.exceptions['exact'], errorCode, feedback);
            }
        }
    }
};
