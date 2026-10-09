let inputImages = document.querySelectorAll(".img");
let playerSymbolDiv = document.querySelector("#user-side");
let computerSymbolDiv = document.querySelector("#computer-side");
let playerScoreDisplay = document.querySelector("#playerScore");
let computerScoreDisplay = document.querySelector("#computerScore");
let resetBtn = document.querySelector("#reset-btn"); 
let lastWinner = document.querySelector("#lastRoundWinner"); 

let playerScore = 0;
let computerScore = 0;


resetBtn.addEventListener("click", () => {
    playerScore = 0;
    computerScore = 0; 
    lastWinner.innerText = ""; 
    playerScoreDisplay.innerText = playerScore; 
    computerScoreDisplay.innerText = computerScore; 
    updatePlayerSymbolImage(null); 
    updateComputerSymbolImage(null); 
});

const selectComputerSymbol = () => {
    const symbols = ["rock", "paper", "scissor"];
    const idx = Math.floor(Math.random() * 3);
    const computerSymbol = symbols[idx];
    return computerSymbol;
};

const updatePlayerSymbolImage = (playerSymbol) => { 
    if (playerSymbol) {
        let userSymbolDiv = document.querySelector(`#${playerSymbol}-div`).cloneNode(true);
        playerSymbolDiv.replaceChild(userSymbolDiv, playerSymbolDiv.lastChild); 
    } else {
        playerSymbolDiv.removeChild(playerSymbolDiv.lastChild); 
    }
};

const updateComputerSymbolImage = (computerSymbol) => { 
    if (computerSymbol) {
        let computerSelectedSymbolDiv = document.querySelector(`#${computerSymbol}-div`).cloneNode(true);
        computerSymbolDiv.replaceChild(computerSelectedSymbolDiv, computerSymbolDiv.lastChild); 
    } else {
        computerSymbolDiv.removeChild(computerSymbolDiv.lastChild); 
    }

};

const updateWinnerScore = (playerSymbol, computerSymbol) => {
    if (playerSymbol == "rock") {
        if (computerSymbol == "rock") {
            lastWinner.innerText = "Draw"; 
        } else if (computerSymbol == "paper") {
            lastWinner.innerText = "Computer"; 
            computerScore += 1; 
        } else {
            lastWinner.innerText = "You"; 
            playerScore += 1; 
        }
    } else if (playerSymbol == "paper") {
        if (computerSymbol == "rock") {
            lastWinner.innerText = "You"; 
            playerScore += 1;  
        } else if (computerSymbol == "paper") {
            lastWinner.innerText = "Draw"; 
        } else {
            lastWinner.innerText = "Computer"; 
            computerScore += 1; 
        } 
    } else {
        if (computerSymbol == "rock") {
            lastWinner.innerText = "Computer"; 
            computerScore += 1;  
        } else if (computerSymbol == "paper") {
            lastWinner.innerText = "You"; 
            playerScore += 1; 
        } else {
            lastWinner.innerText = "Draw"; 
        }
    } 

    playerScoreDisplay.innerText = playerScore; 
    computerScoreDisplay.innerText = computerScore; 


}

const playGame = (playerSymbol) => {
    const computerSymbol = selectComputerSymbol();

    // players selected symbol 
    updatePlayerSymbolImage(playerSymbol);

    // computers selected symbol 
    updateComputerSymbolImage(computerSymbol); 

    updateWinnerScore(playerSymbol, computerSymbol); 

};

inputImages.forEach((input) => {
    input.addEventListener("click", () => {
        const playerSymbol = input.getAttribute("id");
        playGame(playerSymbol);
    });
}); 
