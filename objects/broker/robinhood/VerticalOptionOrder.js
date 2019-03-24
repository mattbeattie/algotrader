const Robinhood = require("./Robinhood");
const OptionInstrument = require("./OptionInstrument");
const request = require("request");
const _ = require("lodash");
const uuidv4 = require("uuid/v4");
const assert = require("assert");

/**
 * Represents and executes an order for the given option vertical.
 */
class VerticalOptionOrder extends Robinhood {
	/**
	 * Creates a new VerticalOptionOrder.
	 *
	 * @param {User} user
	 * @param {Object} object
	 * @property {String} side - buy/sell
	 * @property {String} type - market/limit. Note: market orders are not allowed if side = buy.
	 * @property {Number} price
	 * @property {String} timeInForce - gtc/gfd/ioc/opg
	 * @property {OptionInstrument} option
	 * @property {Number} quantity
	 */
	constructor(user, object) {
		super();
		this.user = user;
		if (object.state === undefined && object.cancel_url === undefined) {
			// This should be a new order
			_validate();
			this.executed = false;
			this.form = {
				account:
					this.url +
					"/accounts/" +
					this.user.getAccountNumber() +
					"/",
				direction: object.side === "buy" ? "debit" : "credit",
				legs: [
					{
						position_effect:
							object.side === "buy" ? "close" : "open",
						side: "buy",
						ratio_quantity: 1,
						option: object.longLeg.instrumentURL
					},
					{
						position_effect:
							object.side === "buy" ? "close" : "open",
						side: "sell",
						ratio_quantity: 1,
						option: object.shortLeg.instrumentURL
					}
				],
				price: object.price,
				time_in_force: object.timeInForce,
				trigger: "immediate",
				type: object.type,
				quantity: object.quantity,
				override_day_trade_checks: false,
				override_dtbp_checks: false,
				ref_id: object.ref_id !== undefined ? object.ref_id : uuidv4()
			};
		} else {
			// This is an existing order
			this.executed = true;
			[
				"opening_strategy",
				"updated_at",
				"ref_id",
				"time_in_force",
				"response_category",
				"chain_symbol",
				"id",
				"chain_id",
				"state",
				"trigger",
				"legs",
				"type",
				"direction",
				"premium",
				"price",
				"pending_quantity",
				"processed_quantity",
				"closing_strategy",
				"processed_premium",
				"created_at",
				"cancel_url",
				"canceled_quantity",
				"quantity"
			].forEach(key => (this[key] = object[key]));
		}
		function _validate() {
			assert(
				typeof user.isAuthenticated === "function" &&
					user.isAuthenticated(),
				new Error(
					"Parameter 'user' must be an instance of the User class and authenticated with Robinhood"
				)
			);
			assert(
				typeof object.side === "string",
				new Error("Object property 'side' must be a string")
			);
			assert(
				object.side === "buy" || object.side === "sell",
				new Error(
					"Object property 'side' must be either 'buy' or 'sell'"
				)
			);
			assert(
				typeof object.type === "string",
				new Error("Object property 'type' must be a string")
			);
			assert(
				object.type === "market" || object.type === "limit",
				new Error(
					"Object property 'type' must be either 'market' or 'limit'"
				)
			);
			assert(
				!(object.side === "buy" && object.type === "market"),
				new Error(
					"Robinhood does not allow buy orders to be of type 'market'"
				)
			);
			assert(
				typeof object.price === "number",
				new Error("Object property 'price' must be a number")
			);
			assert(
				typeof object.timeInForce === "string",
				new Error("Object property 'timeInForce' must be a string")
			);
			assert(
				["gfd", "gtc", "ioc", "opg"].indexOf(
					object.timeInForce.toLowerCase()
				) !== -1,
				new Error(
					"Object property 'timeInForce' must be either GFD, GTC, IOC, or OPG"
				)
			);
			assert(
				object.longLeg instanceof OptionInstrument,
				new Error(
					"Object property 'optionInstrument' must be an instance of the OptionInstrument class"
				)
			);
			assert(
				object.shortLeg instanceof OptionInstrument,
				new Error(
					"Object property 'optionInstrument' must be an instance of the OptionInstrument class"
				)
			);
			assert(
				typeof object.quantity === "number",
				new Error("Object property 'quantity' must be a number")
			);
		}
	}

	/**
	 * Submits the VerticalOptionOrder to Robinhood and returns the executed VerticalOptionOrder.
	 * @returns {Promise<VerticalOptionOrder>}
	 */
	submit() {
		const _this = this;
		return new Promise((resolve, reject) => {
			if (_this.executed) reject("This order has already been executed!");
			else
				request.post(
					{
						uri: _this.url + "/options/orders/",
						headers: {
							Authorization: "Bearer " + _this.user.getAuthToken()
						},
						json: _this.form
					},
					(error, response, body) => {
						return Robinhood.handleResponse(
							error,
							response,
							JSON.stringify(body),
							_this.user.getAuthToken(),
							res => {
								_this.executed = true;
								resolve(
									new VerticalOptionOrder(_this.user, res)
								);
							},
							reject
						);
					}
				);
		});
	}

	/**
	 * Returns an array of executed VerticalOptionOrders.
	 * NOTE: See OptionInstrument.getPositions for an array of open positions.
	 *
	 * @param {User} user
	 * @returns {Promise<VerticalOptionOrder[]>}
	 */
	static getOrders(user) {
		return new Promise((resolve, reject) => {
			request(
				{
					uri: "https://api.robinhood.com/options/orders/",
					headers: {
						Authorization: "Bearer " + user.getAuthToken()
					}
				},
				(error, response, body) => {
					return Robinhood.handleResponse(
						error,
						response,
						body,
						user.getAuthToken(),
						res => {
							let array = [];
							res.forEach(o => {
								if (o.state !== undefined)
									array.push(
										new VerticalOptionOrder(user, o)
									);
							});
							resolve(_.sortBy(array, "created_at"));
						},
						reject
					);
				}
			);
		});
	}

	// GET

	/**
	 * @returns {Array}
	 */
	getLegs() {
		return this.legs;
	}

	/**
	 * @returns {String}
	 */
	getDirection() {
		return this.direction;
	}

	/**
	 * @returns {Number}
	 */
	getPremium() {
		return this.premium;
	}

	/**
	 * @returns {Number}
	 */
	getProcessedPremium() {
		return this.processed_premium;
	}

	/**
	 * @returns {String}
	 */
	getTimeInForce() {
		return this.time_in_force;
	}

	/**
	 * @returns {String}
	 */
	getReferenceID() {
		return this.ref_id;
	}

	/**
	 * @returns {Number}
	 */
	getPrice() {
		return Number(this.price);
	}

	/**
	 * @returns {String}
	 */
	getTrigger() {
		return this.trigger;
	}

	/**
	 * @returns {String}
	 */
	getType() {
		return this.type;
	}

	/**
	 * @returns {Number}
	 */
	getQuantity() {
		return Number(this.quantity);
	}

	/**
	 * @returns {Number}
	 */
	getQuantityPending() {
		return Number(this.pending_quantity);
	}

	/**
	 * @returns {Number}
	 */
	getQuantityCanceled() {
		return Number(this.canceled_quantity);
	}

	/**
	 * @returns {String}
	 */
	getChainID() {
		return this.chain_id;
	}

	/**
	 * @returns {String}
	 */
	getSymbol() {
		return this.chain_symbol;
	}

	/**
	 * @returns {Date}
	 */
	getDateCreated() {
		return new Date(this.created_at);
	}

	// BOOLEANS

	/**
	 * @returns {Boolean}
	 */
	isExecuted() {
		return this.executed;
	}

	/**
	 * @returns {Boolean}
	 */
	isCredit() {
		return this.direction === "credit";
	}

	/**
	 * @returns {Boolean}
	 */
	isDebit() {
		return this.direction === "debit";
	}
}

module.exports = VerticalOptionOrder;
