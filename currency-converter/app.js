import { countryList } from "./countryCodes.js";

const BASE_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/"; // append from_curr.json 
const FLAG_BASE_URL = "https://flagcdn.com/w320/"; //append country_code.png 

let amountInput = document.querySelector("#amount-input");

let countryDataList = document.querySelectorAll(".curr-list");
let currencyInputBoxes = document.querySelectorAll(".curr-input");

let fromInput = document.querySelector("#from-input");
let toInput = document.querySelector("#to-input");

const result = document.querySelector("#result");
const btn = document.querySelector("#btn"); 


// change in currency input box triggers flag change 
currencyInputBoxes.forEach((inputBox) => {
    inputBox.addEventListener("change", (e) => {
        let countryCode = e.target.value;

        getFlag(inputBox.parentNode.querySelector(".flag"), countryCode);
    });
});


const getFlag = async (img, country_code) => {
    const str = `${FLAG_BASE_URL}${country_code.toLowerCase()}.png`;    // flag api call

    img.src = str;
}


// load country codes in datalist 
(() => {
    // Sort by currency code (A-Z)
    const sortedCountryList = Object.entries(countryList)
        .sort((a, b) => a[1].localeCompare(b[1]));

    // in each list, add the country codes and currency codes 
    for (let datalist of countryDataList) {
        for (let [countryCode, currencyCode] of sortedCountryList) {
            let newOption = document.createElement("option");

            newOption.setAttribute("label", `${currencyCode}`);
            newOption.setAttribute("value", `${countryCode}`);

            // set default 
            if (datalist.id == "from-list" && countryCode == "US") {
                fromInput.value = countryCode;
                getFlag(datalist.parentNode.querySelector("img"), countryCode);
            } else if (datalist.id == "to-list" && countryCode == "BD") {
                toInput.value = countryCode;
                getFlag(datalist.parentNode.querySelector("img"), countryCode);
            }

            datalist.append(newOption);
        }
    }
})();


// convert button clicked
btn.addEventListener("click", async () => {
    let amount = amountInput.value;

    const fromCurr = countryList[fromInput.value.toUpperCase()];
    const toCurr = countryList[toInput.value.toUpperCase()];

    let data = await getData(fromCurr.toLowerCase(), toCurr.toLowerCase());

    if (amount == "" || amount <= 0) {
        amount = 1;
        amountInput.value = 1;
    }

    console.log(data);

    result.innerText = `${amount} ${fromCurr} = ${amount * data} ${toCurr}`;
});


const getData = async (fromCurr, toCurr) => {
    const response = await fetch(`${BASE_URL}${fromCurr}.json`);    // currency api call 
    const data = await response.json();

    return data[fromCurr][toCurr];
}


