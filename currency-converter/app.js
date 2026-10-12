import { countryList } from "./countryCodes.js";

const BASE_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/"; // from_curr/to_curr.json 
const FLAG_BASE_URL = "https://flagcdn.com/w320/"; //country_code.png 


let amountInput = document.querySelector("#amount"); 
let fromImg = document.querySelector("#from-flag"); 
let toImg = document.querySelector("#to-flag"); 
let countryDropdown = document.querySelectorAll(".select-tag");   
let from = document.querySelector("#from-select"); 
let to = document.querySelector("#to-select"); 

const result = document.querySelector("#result"); 
const btn = document.querySelector("#btn"); 




countryDropdown.forEach((selectBox) => {
    selectBox.addEventListener("change", (e)=> {
        let countryCode = e.target.value; 
        getFlag(selectBox.parentNode.querySelector(".flag"), countryCode); 
    }); 
}); 


const getFlag = async (img, country_code) => {
    const str = `${FLAG_BASE_URL}${country_code}.png`; 

    img.src = `https://flagcdn.com/w320/${country_code.toLowerCase()}.png`; 
}


// load country codes in dropdown 
(() => { 
    // Sort by currency code (A-Z)
    const sortedCountryList = Object.entries(countryList)
    .sort((a, b) => a[1].localeCompare(b[1]));
    
    for (let dropdown of countryDropdown) {
        for (let [countryCode, currencyCode] of sortedCountryList) { 
            let newOption = document.createElement("option"); 
            newOption.setAttribute("value", `${countryCode}`); 
            newOption.innerText = `${currencyCode} (${countryCode})`; 
            
            if (dropdown.name == "from" && countryCode == "US") {
                newOption.selected = true; 
                getFlag(dropdown.parentNode.querySelector("img"), countryCode); 
            } else if (dropdown.name == "to" && countryCode == "BD") { 
                getFlag(dropdown.parentNode.querySelector("img"), countryCode); 
                newOption.selected = true; 
            }
            
            dropdown.append(newOption); 
        } 
    }
})(); 


btn.addEventListener("click", async () => {
    let amount = amountInput.value; 
    const fromCurr = countryList[from.value.toUpperCase()]; 
    const toCurr = countryList[to.value.toUpperCase()]; 
    let data = await getData(fromCurr.toLowerCase(), toCurr.toLowerCase()); 

    if(amount == "" || amount <= 0) {
        amount = 1; 
        amountInput.value = 1; 
    } 

    console.log(data); 

    result.innerText = `${amount} ${fromCurr} = ${amount * data} ${toCurr}`; 
})


const getData = async (fromCurr, toCurr) => {
    const response = await fetch(`${BASE_URL}${fromCurr}.json`); 
    const data = await response.json();  
    
    return data[fromCurr][toCurr]; 
} 


