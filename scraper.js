/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const cheerio = require("cheerio");
const fetch = require("node-fetch");
const fs = require("fs");
const sendmail = require("sendmail")({ silent: true });

var config;

if (initConfig()) {
    setInterval(() => { scrape(); }, config.interval_checkup_hours * 1000 * 60 * 60);
    scrape();
}

function initConfig() {
    var emailFromReg = /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i;
    var emailToReg = /^[\W]*([\w+\-.%]+@[\w\-.]+\.[A-Za-z]{2,4}[\W]*,{1}[\W]*)*([\w+\-.%]+@[\w\-.]+\.[A-Za-z]{2,4})[\W]*$/i;    // accept multiple email recipients separated by commas

    if (!fs.existsSync("config.json")) {
        console.log("Cannot find config.json");
        return false;
    }

    try {
        config = JSON.parse(fs.readFileSync("config.json", "utf8"));
    } catch (ex) {
        console.log("Cannot load config.json : " + ex && ex.stack);
        return false;
    }

    if (!config.urls || config.urls.length < 1) {
        console.log("config.json : cannot read urls to scrape");
        return false;
    }

    if (!emailFromReg.test(config.email_from)) {
        console.log("config.json : email_from is not valid");
        return false;
    }

    if (!emailToReg.test(config.email_to)) {
        console.log("config.json : email_to is not valid");
        return false;
    }

    return true;
}

function scrape() {
    const grabContent = url => fetch(url)
        .then(res => res.text())
        .then(html => checkPrices(html));

    Promise.all(config.urls.map(grabContent))
        .then(data => sendEmail(data));
}

function checkPrices(html) {
    var $ = cheerio.load(html);
    var normalPrice, salePrice;

    salePrice = $(".product_saleprice");

    if (salePrice.length) {
        normalPrice = $(".product_productprice").text().trim() + "$";
        salePrice = salePrice.text().trim() + "$";
        return {
            normalPrice: normalPrice,
            salePrice: salePrice
        };
    } else {
        return null;
    }
}

function sendEmail(prices) {
    var html = "";
    var isSendingEmail = false;

    prices.forEach((elem, i) => {
        if (elem) {
            html += (config.urls[i] + " is on sale : <b>" + elem.salePrice + "</b> (normal " + elem.normalPrice + ")<br/><br/>");
            isSendingEmail = true;
        }
    }, this);

    if (isSendingEmail) {
        sendmail({
            from: config.email_from,
            to: config.email_to,
            subject: config.email_subject,
            html: html
        }, (err, reply) => {
            if (err) {
                console.log(err && err.stack);
            }
        });
    }
}
