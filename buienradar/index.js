/* eslint-disable  func-names */
/* eslint quote-props: ["error", "consistent"]*/

'use strict';

const rp = require('request-promise-native');
const Alexa = require('alexa-sdk');
const beaufort = require('beaufort-scale');
const format = require('string-format');
const APP_ID = undefined;  // TODO replace with your app ID (OPTIONAL).

const languageStrings = {
    'en-GB': {
        translation: {
            SKILL_NAME: 'British Weer',
            // current temp options
            GET_CURRENT_MESSAGE_FEELS_LIKE: "In {city} it is currently {currentTemp} degrees, but it feels like {currentFeelsLikeTemp}.",
            GET_CURRENT_MESSAGE_FEELS_LIKE_IS_CURRENT: "In {city} it is currently {currentTemp} degrees.",

            GET_MAX_MIN_TEMP_MESSAGE: "The low for the rest of the day will be {dailyMinTemp} degrees with a high of {dailyMaxTemp} degrees.",
            GET_WIND_MESSAGE: "Wind is currently a {windType}.",
            GET_RAIN_MESSAGE_NOW: "There is a {rain.chanceOfRain} percent chance of rain this hour.",
            GET_RAIN_MESSAGE_FUTURE: "There is a {rain.chanceOfRain} percent chance of rain in around {rain.hoursUntilRain} hours.",
            GET_NO_RAIN_FOR_REST_OF_DAY: "There is no chance of rain for the rest of the day.",
            HELP_MESSAGE: 'You can say tell me a space fact, or, you can say exit... What can I help you with?',
            HELP_REPROMPT: 'What can I help you with?',
            STOP_MESSAGE: 'Goodbye!',
        },
    },
    'en-US': {
        translation: {
            SKILL_NAME: 'American Weer',
            // current temp options
            GET_CURRENT_MESSAGE_FEELS_LIKE: "In {city} it is currently {currentTemp} degrees, but it feels like {currentFeelsLikeTemp}.",
            GET_CURRENT_MESSAGE_FEELS_LIKE_IS_CURRENT: "In {city} it is currently {currentTemp} degrees.",

            GET_MAX_MIN_TEMP_MESSAGE: "The low for the rest of the day will be {dailyMinTemp} degrees with a high of {dailyMaxTemp} degrees.",
            GET_WIND_MESSAGE: "Wind is currently a {windType}.",
            GET_RAIN_MESSAGE_NOW: "There is a {rain.chanceOfRain} percent chance of rain this hour.",
            GET_RAIN_MESSAGE_FUTURE: "There is a {rain.chanceOfRain} percent chance of rain in around {rain.hoursUntilRain} hours.",
            GET_NO_RAIN_FOR_REST_OF_DAY: "There is no chance of rain for the rest of the day.",
            HELP_MESSAGE: 'You can say tell me a space fact, or, you can say exit... What can I help you with?',
            HELP_REPROMPT: 'What can I help you with?',
            STOP_MESSAGE: 'Goodbye!',
        },
    }
    // 'de-DE': {
    //     translation: {
    //         FACTS: [
    //             'Ein Jahr dauert auf dem Merkur nur 88 Tage.',
    //             'Die Venus ist zwar weiter von der Sonne entfernt, hat aber höhere Temperaturen als Merkur.',
    //             'Venus dreht sich entgegen dem Uhrzeigersinn, möglicherweise aufgrund eines früheren Zusammenstoßes mit einem Asteroiden.',
    //             'Auf dem Mars erscheint die Sonne nur halb so groß wie auf der Erde.',
    //             'Die Erde ist der einzige Planet, der nicht nach einem Gott benannt ist.',
    //             'Jupiter hat den kürzesten Tag aller Planeten.',
    //             'Die Milchstraßengalaxis wird in etwa 5 Milliarden Jahren mit der Andromeda-Galaxis zusammenstoßen.',
    //             'Die Sonne macht rund 99,86 % der Masse im Sonnensystem aus.',
    //             'Die Sonne ist eine fast perfekte Kugel.',
    //             'Eine Sonnenfinsternis kann alle ein bis zwei Jahre eintreten. Sie ist daher ein seltenes Ereignis.',
    //             'Der Saturn strahlt zweieinhalb mal mehr Energie in den Weltraum aus als er von der Sonne erhält.',
    //             'Die Temperatur in der Sonne kann 15 Millionen Grad Celsius erreichen.',
    //             'Der Mond entfernt sich von unserem Planeten etwa 3,8 cm pro Jahr.',
    //         ],
    //         SKILL_NAME: 'Weltraumwissen auf Deutsch',
    //         GET_WEATHER_MESSAGE: 'Hier sind deine Fakten: ',
    //         HELP_MESSAGE: 'Du kannst sagen, „Nenne mir einen Fakt über den Weltraum“, oder du kannst „Beenden“ sagen... Wie kann ich dir helfen?',
    //         HELP_REPROMPT: 'Wie kann ich dir helfen?',
    //         STOP_MESSAGE: 'Auf Wiedersehen!',
    //     },
    // },
};

const buienRaderForecast = function (forecast, hours_ahead_to_check_rain, rain_percent_threshold = 9) {
    const rain = (forecast, hours_ahead_to_check_rain) => {
        // the site only returns an hours array containing the amount of hours left depending on request time
        let hoursLeftInDay = Object.keys(forecast['days'][0]['hours']).length;

        let hoursToCheck;

        // only go through the rest of the hours in the day, even if user asks for more
        if (hoursLeftInDay < hours_ahead_to_check_rain) {
            hoursToCheck = hoursLeftInDay;
        } else {
            hoursToCheck = hours_ahead_to_check_rain;
        }


        // loop through each of the hours in the day, and find the hour when there is a chance of rain
        for (let i = 0, len = hoursToCheck; i < len; i++) {
            let chanceOfRain = forecast['days'][0]['hours'][i]['precipation'];

            if (chanceOfRain > rain_percent_threshold) {
                return {
                    chanceOfRain: chanceOfRain,
                    hoursUntilRain: i
                }
            }
        }

        return null; // there is no rain up coming
    };

    let currentTemp = roundFloat(forecast['days'][0]['hours'][0]['temperature']);
    let currentFeelsLikeTemp = roundFloat(forecast['days'][0]['hours'][0]['feeltemperature']);

    return {
        dailyMaxTemp: roundFloat(forecast['days'][0]['maxtemp']),
        dailyMinTemp: roundFloat(forecast['days'][0]['mintemp']),
        currentTemp: currentTemp,
        currentFeelsLikeTemp: currentFeelsLikeTemp,
        feelsLikeEqualCurrentTemp: currentTemp === currentFeelsLikeTemp,
        windType: beaufort(forecast['days'][0]['hours'][0]['windspeed']).desc.toLowerCase(),
        rain: rain(forecast, hours_ahead_to_check_rain)
    }
};

// round temperatures which come in as floats
const roundFloat = (float) => {
    return Math.round(float);
};

const handlers = {
    'LaunchRequest': function () {
        this.emit('GetWeer');
    },
    'GetWeerRainIntent': function () {
        let options = {
            uri: 'https://api.buienradar.nl/data/forecast/1.1/all/2747596',
            json: true
        };

        rp(options)
            .then((weather) => {
                let forecast = buienRaderForecast(weather, 24, 0);

                forecast['city'] = 'Schiedam';

                let speechOut = [];

                // rain message
                if (forecast.rain) {
                    speechOut.push(
                        format(
                            (forecast.rain.hoursUntilRain > 0) ? this.t('GET_RAIN_MESSAGE_FUTURE') : this.t('GET_RAIN_MESSAGE_NOW'),
                            forecast
                        )
                    );
                } else {
                    speechOut.push(
                        this.t('GET_NO_RAIN_FOR_REST_OF_DAY')
                    );
                }

                this.emit(':tellWithCard', speechOut.join(' '), this.t('SKILL_NAME'), speechOut.join(' '))
            })
            .catch((err) => {
                const speechOutput = 'Failed to query for Weather information: ' + err;
                this.emit(':tellWithCard', speechOutput, this.t('SKILL_NAME'), speechOutput);
            });
    },
    'GetWeerIntent': function () {
        this.emit('GetWeer');
    },
    'GetWeer': function () {
        let options = {
            uri: 'https://api.buienradar.nl/data/forecast/1.1/all/2747596',
            json: true
        };

        rp(options)
            .then((weather) => {
                let forecast = buienRaderForecast(weather, 5);

                forecast['city'] = 'Schiedam';

                let speechOut = [];

                // get current temp
                speechOut.push(
                    format(
                        forecast.feelsLikeEqualCurrentTemp ? this.t('GET_CURRENT_MESSAGE_FEELS_LIKE_IS_CURRENT') : this.t('GET_CURRENT_MESSAGE_FEELS_LIKE'),
                        forecast
                    )
                );

                // min max temp message
                speechOut.push(
                    format(
                        this.t('GET_MAX_MIN_TEMP_MESSAGE'),
                        forecast
                    )
                );

                // wind message
                speechOut.push(
                    format(
                        this.t('GET_WIND_MESSAGE'),
                        forecast
                    )
                );

                // rain message
                if (forecast.rain) {
                    speechOut.push(
                        format(
                            (forecast.rain.hoursUntilRain > 0) ? this.t('GET_RAIN_MESSAGE_FUTURE') : this.t('GET_RAIN_MESSAGE_NOW'),
                            forecast
                        )
                    );
                }

                this.emit(':tellWithCard', speechOut.join(' '), this.t('SKILL_NAME'), speechOut.join(' '))
            })
            .catch((err) => {
                const speechOutput = 'Failed to query for Weather information: ' + err;
                this.emit(':tellWithCard', speechOutput, this.t('SKILL_NAME'), speechOutput);
            });
    },
    'AMAZON.HelpIntent': function () {
        const speechOutput = this.t('HELP_MESSAGE');
        const reprompt = this.t('HELP_MESSAGE');
        this.emit(':ask', speechOutput, reprompt);
    },
    'AMAZON.CancelIntent': function () {
        this.emit(':tell', this.t('STOP_MESSAGE'));
    },
    'AMAZON.StopIntent': function () {
        this.emit(':tell', this.t('STOP_MESSAGE'));
    },
    'SessionEndedRequest': function () {
        this.emit(':tell', this.t('STOP_MESSAGE'));
    },
};

exports.handler = (event, context) => {
    const alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};
