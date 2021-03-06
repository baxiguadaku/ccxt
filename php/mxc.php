<?php

namespace ccxt;

// PLEASE DO NOT EDIT THIS FILE, IT IS GENERATED AND WILL BE OVERWRITTEN:
// https://github.com/ccxt/ccxt/blob/master/CONTRIBUTING.md#how-to-contribute-code

use Exception; // a common import
use \ccxt\ExchangeError;
use \ccxt\ArgumentsRequired;

class mxc extends Exchange {

    public function describe () {
        return array_replace_recursive(parent::describe (), array(
            'id' => 'mxc',
            'name' => 'MXC',
            'countries' => array( 'CN' ),
            'version' => 'v1',
            'rateLimit' => 1000,
            'has' => array(
                'CORS' => false,
                'createMarketOrder' => false,
                'fetchTickers' => true,
                'withdraw' => false,
                'fetchDeposits' => false,
                'fetchWithdrawals' => false,
                'fetchTransactions' => false,
                'createDepositAddress' => false,
                'fetchDepositAddress' => false,
                'fetchClosedOrders' => false,
                'fetchOHLCV' => true,
                'fetchOpenOrders' => false,
                'fetchOrderTrades' => false,
                'fetchOrders' => true,
                'fetchOrder' => true,
                'fetchMyTrades' => false,
            ),
            'timeframes' => array(
                '1m' => '60',
                '5m' => '300',
                '15m' => '900',
                '30m' => '1800',
                '60m' => '3600',
                '1h' => '3600',
                '2h' => '7200',
                '4h' => '14400',
                '6h' => '21600',
                '12h' => '43200',
                '1d' => '86400',
                '1w' => '604800',
            ),
            'urls' => array(
                'logo' => '',
                'api' => array(
                    'public' => 'https://www.mxc.ceo/open/api/v1/data/',
                    'private' => 'https://www.mxc.ceo/open/api/v1/private/',
                ),
                'www' => 'https://mxc.ceo/',
                'doc' => 'https://github.com/mxcdevelop/APIDoc',
                'fees' => array(
                    'https://www.mxc.ceo/info/fee',
                ),
                'referral' => '',
            ),
            'api' => array(
                'public' => array(
                    'get' => array(
                        'markets',
                        'markets_info',
                        'depth',
                        'history',
                        'ticker',
                        'kline',
                    ),
                ),
                'private' => array(
                    'get' => array(
                        'account/info',
                        'current/orders',
                        'orders',
                        'order',
                    ),
                    'post' => array(
                        'order',
                        'order_batch',
                        'order_cancel',
                    ),
                    'delete' => array(
                        'order',
                    ),
                ),
            ),
            'fees' => array(
                'trading' => array(
                    'tierBased' => true,
                    'percentage' => true,
                    'maker' => 0.002,
                    'taker' => 0.002,
                ),
            ),
            'exceptions' => array(
            ),
            // https://gate.io/api2#errCode
            'errorCodeNames' => array(
            ),
            'options' => array(
                'limits' => array(
                    'cost' => array(
                        'min' => array(
                            'BTC' => 0.0001,
                            'ETH' => 0.001,
                            'USDT' => 1,
                        ),
                    ),
                ),
            ),
        ));
    }

    public function fetch_markets ($params = array ()) {
        $response = $this->publicGetMarketsInfo ($params);
        $markets = $this->safe_value($response, 'data');
        if (!$markets) {
            throw new ExchangeError($this->id . ' fetchMarkets got an unrecognized response');
        }
        $result = array();
        $keys = is_array($markets) ? array_keys($markets) : array();
        for ($i = 0; $i < count($keys); $i++) {
            $id = $keys[$i];
            $market = $markets[$id];
            $details = $market;
            // all of their symbols are separated with an underscore
            // but not boe_eth_eth (BOE_ETH/ETH) which has two underscores
            // https://github.com/ccxt/ccxt/issues/4894
            $parts = explode('_', $id);
            $numParts = is_array($parts) ? count($parts) : 0;
            $baseId = $parts[0];
            $quoteId = $parts[1];
            if ($numParts > 2) {
                $baseId = $parts[0] . '_' . $parts[1];
                $quoteId = $parts[2];
            }
            $base = $this->safe_currency_code($baseId);
            $quote = $this->safe_currency_code($quoteId);
            $symbol = $base . '/' . $quote;
            $precision = array(
                'amount' => 8,
                'price' => $details['priceScale'],
            );
            $amountLimits = array(
                'min' => $details['minAmount'],
                'max' => null,
            );
            $priceLimits = array(
                'min' => pow(10, -$details['priceScale']),
                'max' => null,
            );
            $defaultCost = $amountLimits['min'] * $priceLimits['min'];
            $minCost = $this->safe_float($this->options['limits']['cost']['min'], $quote, $defaultCost);
            $costLimits = array(
                'min' => $minCost,
                'max' => null,
            );
            $limits = array(
                'amount' => $amountLimits,
                'price' => $priceLimits,
                'cost' => $costLimits,
            );
            $active = true;
            $result[] = array(
                'id' => $id,
                'symbol' => $symbol,
                'base' => $base,
                'quote' => $quote,
                'baseId' => $baseId,
                'quoteId' => $quoteId,
                'info' => $market,
                'active' => $active,
                'maker' => $details['sellFeeRate'],
                'taker' => $details['buyFeeRate'],
                'precision' => $precision,
                'limits' => $limits,
            );
        }
        return $result;
    }

    public function fetch_balance ($params = array ()) {
        $this->load_markets();
        $request = array(
            'api_key' => $this->apiKey,
            'req_time' => $this->milliseconds (),
        );
        $response = $this->privateGetAccountInfo (array_merge($request, $params));
        $result = array( 'info' => $response );
        $currencyIds = is_array($response) ? array_keys($response) : array();
        for ($i = 0; $i < count($currencyIds); $i++) {
            $currencyId = $currencyIds[$i];
            $code = $this->safe_currency_code($currencyId);
            $account = $this->account ();
            $account['free'] = $this->safe_float($response[$currencyId], 'available');
            $account['used'] = $this->safe_float($response[$currencyId], 'frozen');
            $result[$code] = $account;
        }
        return $this->parse_balance($result);
    }

    public function fetch_order_book ($symbol, $limit = null, $params = array ()) {
        $this->load_markets();
        $request = array(
            'depth' => 5,
            'market' => $this->market_id($symbol),
        );
        $response = $this->publicGetDepth (array_merge($request, $params));
        $orderbook = $this->safe_value($response, 'data');
        return $this->parse_order_book($orderbook, null, 'bids', 'asks', 'price', 'quantity');
    }

    public function parse_ohlcv ($ohlcv, $market = null, $timeframe = '1m', $since = null, $limit = null) {
        // they return array( Timestamp, Volume, Close, High, Low, Open )
        return [
            intval ($ohlcv[0]),   // t
            floatval ($ohlcv[1]), // o
            floatval ($ohlcv[2]), // c
            floatval ($ohlcv[3]), // h
            floatval ($ohlcv[4]), // l
            floatval ($ohlcv[5]), // v
        ];
    }

    public function fetch_ohlcv ($symbol, $timeframe = '1m', $since = null, $limit = null, $params = array ()) {
        $this->load_markets();
        $market = $this->market ($symbol);
        $now = $this->milliseconds ();
        $request = array(
            'market' => $this->market_id($symbol),
            'interval' => $this->timeframes[$timeframe],
            'startTime' => $now / 1000,
        );
        // max $limit = 1001
        if ($limit !== null) {
            $periodDurationInSeconds = $this->parse_timeframe($timeframe);
            $hours = intval (($periodDurationInSeconds * $limit) / 3600);
            $request['range_hour'] = max (0, $hours - 1);
        }
        if ($since !== null) {
            $request['startTime'] = intval ($since / 1000);
        }
        $response = $this->publicGetKline (array_merge($request, $params));
        //        ordering => Ts, O, C, H, L, V
        //     {
        //         "code" => 200,
        //         "$data" => array(
        //             array( "TS", "o", "c", "h", "l", "v" ),
        //         )
        //     }
        //
        $data = $this->safe_value($response, 'data', array());
        return $this->parse_ohlcvs($data, $market, $timeframe, $since, $limit);
    }

    public function parse_ticker ($ticker, $market = null) {
        $timestamp = $this->milliseconds ();
        $symbol = null;
        if ($market) {
            $symbol = $market['symbol'];
        }
        $last = $this->safe_float($ticker, 'last');
        $percentage = $this->safe_float($ticker, 'percentChange');
        $open = $this->safe_float($ticker, 'open');
        $change = null;
        $average = null;
        if (($last !== null) && ($percentage !== null)) {
            $change = $last - $open;
            $average = $this->sum ($last, $open) / 2;
        }
        return array(
            'symbol' => $symbol,
            'timestamp' => $timestamp,
            'datetime' => $this->iso8601 ($timestamp),
            'high' => $this->safe_float($ticker, 'high'),
            'low' => $this->safe_float($ticker, 'low'),
            'bid' => $this->safe_float($ticker, 'buy'),
            'bidVolume' => null,
            'ask' => $this->safe_float($ticker, 'sell'),
            'askVolume' => null,
            'vwap' => null,
            'open' => $open,
            'close' => $last,
            'last' => $last,
            'previousClose' => null,
            'change' => $change,
            'percentage' => $percentage,
            'average' => $average,
            'baseVolume' => $this->safe_float($ticker, 'volume'), // gateio has them reversed
            'quoteVolume' => null,
            'info' => $ticker,
        );
    }

    public function fetch_tickers ($symbols = null, $params = array ()) {
        $this->load_markets();
        $response = $this->publicGetTicker ($params);
        $result = array();
        $data = $this->safe_value($response, 'data', array());
        $ids = is_array($data) ? array_keys($data) : array();
        for ($i = 0; $i < count($ids); $i++) {
            $id = $ids[$i];
            list($baseId, $quoteId) = explode('_', $id);
            $base = strtoupper($baseId);
            $quote = strtoupper($quoteId);
            $base = $this->safe_currency_code($base);
            $quote = $this->safe_currency_code($quote);
            $symbol = $base . '/' . $quote;
            $market = null;
            if (is_array($this->markets) && array_key_exists($symbol, $this->markets)) {
                $market = $this->markets[$symbol];
            }
            if (is_array($this->markets_by_id) && array_key_exists($id, $this->markets_by_id)) {
                $market = $this->markets_by_id[$id];
            }
            $result[$symbol] = $this->parse_ticker($data[$id], $market);
        }
        return $result;
    }

    public function fetch_ticker ($symbol, $params = array ()) {
        $this->load_markets();
        $market = $this->market ($symbol);
        $ticker = $this->publicGetTicker (array_merge(array(
            'market' => $this->market_id($symbol),
        ), $params));
        return $this->parse_ticker($ticker, $market);
    }

    public function parse_trade ($trade, $market = null) {
        $dateStr = $this->safe_value($trade, 'tradeTime');
        $timestamp = null;
        if ($dateStr !== null) {
            $timestamp = $this->parse_date($dateStr . '  GMT+8');
        }
        // take either of orderid or orderId
        $price = $this->safe_float($trade, 'tradePrice');
        $amount = $this->safe_float($trade, 'tradeQuantity');
        $type = $this->safe_string($trade, 'tradeType');
        $cost = null;
        if ($price !== null) {
            if ($amount !== null) {
                $cost = $price * $amount;
            }
        }
        $symbol = null;
        if ($market !== null) {
            $symbol = $market['symbol'];
        }
        return array(
            'id' => null,
            'info' => $trade,
            'timestamp' => $timestamp,
            'datetime' => $this->iso8601 ($timestamp),
            'symbol' => $symbol,
            'order' => null,
            'type' => null,
            'side' => $type === '1' ? 'buy' : 'sell',
            'takerOrMaker' => null,
            'price' => $price,
            'amount' => $amount,
            'cost' => $cost,
            'fee' => null,
        );
    }

    public function fetch_trades ($symbol, $since = null, $limit = null, $params = array ()) {
        $this->load_markets();
        $market = $this->market ($symbol);
        $request = array(
            'market' => $this->market_id($symbol),
        );
        $response = $this->publicGetHistory (array_merge($request, $params));
        return $this->parse_trades($response['data'], $market, $since, $limit);
    }

    public function fetch_orders ($symbol = null, $since = null, $limit = null, $params = array ()) {
        $request = array(
            'api_key' => $this->apiKey,
            'req_time' => $this->milliseconds (),
        );
        $response = $this->privateGetCurrentOrders (array_merge($request, $params));
        return $this->parse_orders($response['data'], null, $since, $limit);
    }

    public function fetch_order ($id, $symbol = null, $params = array ()) {
        $this->load_markets();
        $request = array(
            'trade_no' => $id,
            'market' => $this->market_id($symbol),
            'api_key' => $this->apiKey,
            'req_time' => $this->milliseconds (),
        );
        $response = $this->privateGetOrder (array_merge($request, $params));
        return $this->parse_order($response['data']);
    }

    public function parse_order_side ($side) {
        $sides = array(
            '1' => 'buy',
            '2' => 'sell',
        );
        return $this->safe_string($sides, $side, $side);
    }

    public function parse_order_status ($status) {
        $statuses = array(
            '1' => 'open',
            '2' => 'closed',
            '3' => 'open', // partial closed
            '4' => 'canceled', // partial closed
            '5' => 'canceled', // partial canceled
        );
        return $this->safe_string($statuses, $status, $status);
    }

    public function parse_order ($order, $market = null) {
        // Different API endpoints returns $order info in different format...
        // with different fields $filled->
        $id = $this->safe_string($order, 'id');
        if ($id === null) {
            $id = $this->safe_string($order, 'data');
        }
        $symbol = null;
        $marketId = $this->safe_string($order, 'market');
        if (is_array($this->markets_by_id) && array_key_exists($marketId, $this->markets_by_id)) {
            $market = $this->markets_by_id[$marketId];
        }
        if ($market !== null) {
            $symbol = $market['symbol'];
        }
        $dateStr = $this->safe_string($order, 'createTime');
        // XXX => MXC returns $order creation times in GMT+8 timezone with out specifying it
        //  hence appending ' GMT+8' to it so we can get the correct value
        // XXX => Also MXC api does not return actual matched prices and costs/fees
        $timestamp = null;
        if ($dateStr !== null) {
            $timestamp = $this->parse_date($dateStr . '  GMT+8');
        }
        $status = $this->parse_order_status($this->safe_string($order, 'status'));
        $side = $this->parse_order_side ($this->safe_string($order, 'type'));
        $price = $this->safe_float($order, 'price');
        $amount = $this->safe_float($order, 'totalQuantity');
        if ($amount === null) {
            $amount = $this->safe_float($order, 'initialAmount');
        }
        $filled = $this->safe_float($order, 'tradedQuantity');
        $average = null;
        $remaining = null;
        if (($filled !== null) && ($amount !== null)) {
            $remaining = $amount - $filled;
        }
        return array(
            'id' => $id,
            'datetime' => $this->iso8601 ($timestamp),
            'timestamp' => $timestamp,
            'status' => $status,
            'symbol' => $symbol,
            'type' => 'limit',
            'side' => $side,
            'price' => $price,
            'cost' => null,
            'amount' => $amount,
            'filled' => $filled,
            'remaining' => $remaining,
            'average' => $average,
            'trades' => null,
            'fee' => array(
                'cost' => null,
                'currency' => null,
                'rate' => null,
            ),
            'info' => $order,
        );
    }

    public function create_order ($symbol, $type, $side, $amount, $price = null, $params = array ()) {
        if ($type === 'market') {
            throw new ExchangeError($this->id . ' allows limit orders only');
        }
        $this->load_markets();
        $market = $this->market ($symbol);
        $request = array(
            'api_key' => $this->apiKey,
            'req_time' => $this->milliseconds (),
            'market' => $this->market_id($symbol),
            'price' => $price,
            'quantity' => $amount,
            'trade_type' => ($side === 'buy') ? '1' : '2',
        );
        $response = $this->privatePostOrder (array_merge($request, $params));
        return $this->parse_order(array_merge(array(
            'status' => 'open',
            'type' => $side,
            'initialAmount' => $amount,
        ), $response), $market);
    }

    public function cancel_order ($id, $symbol = null, $params = array ()) {
        if ($symbol === null) {
            throw new ArgumentsRequired($this->id . ' cancelOrder requires $symbol argument');
        }
        $this->load_markets();
        $request = array(
            'api_key' => $this->apiKey,
            'req_time' => $this->milliseconds (),
            'market' => $this->market_id($symbol),
            'trade_no' => $id,
        );
        return $this->privateDeleteOrder (array_merge($request, $params));
    }

    public function sign ($path, $api = 'public', $method = 'GET', $params = array (), $headers = null, $body = null) {
        $url = $this->urls['api'][$api] . $this->implode_params($path, $params);
        $query = $this->omit ($params, $this->extract_params($path));
        if ($api === 'public') {
            if ($query) {
                $url .= '?' . $this->urlencode ($query);
            }
        } else {
            $this->check_required_credentials();
            $auth = $this->rawencode ($this->keysort ($query));
            $signature = $this->hash ($this->encode ($auth . '&api_secret=' . $this->secret), 'md5');
            $suffix = 'sign=' . $signature;
            $url .= '?' . $auth . '&' . $suffix;
        }
        return array( 'url' => $url, 'method' => $method, 'body' => $body, 'headers' => $headers );
    }

    public function handle_errors ($code, $reason, $url, $method, $headers, $body, $response, $requestHeaders, $requestBody) {
        if ($response === null) {
            return;
        }
        $resultString = $this->safe_string($response, 'result', '');
        if ($resultString !== 'false') {
            return;
        }
        $errorCode = $this->safe_string($response, 'code');
        $message = $this->safe_string($response, 'message', $body);
        if ($errorCode !== null) {
            $feedback = $this->safe_string($this->errorCodeNames, $errorCode, $message);
            $this->throw_exactly_matched_exception($this->exceptions['exact'], $errorCode, $feedback);
        }
    }
}
