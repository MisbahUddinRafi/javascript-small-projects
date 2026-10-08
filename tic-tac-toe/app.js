// elements 
let boxes = document.querySelectorAll(".box");
let restartBtn = document.querySelector("#restart-btn");
let resultDiv = document.querySelector(".result-div");
let resultMsg = document.querySelector("#result-msg");
let newGameBtn = document.querySelector("#newGameBtn"); 
let currentPlayer = document.querySelector("#currentPlayerText"); 

// possible winning states 
const winStates = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
]

// variables 
let playerO = true; // playerO, playerX 
let movesCount = 0;  // number of moves 


// current player 
const resetCurrentPlayerText = () => {
    let player = playerO===true? "O" : "X"; 
    currentPlayer.innerText = `Player ${player}`; 
}; 

// reset player text when refreshed 
resetCurrentPlayerText(); 

// restart game button 
const restartGame = () => { 
    // clear all boxes 
    for (let box of boxes) {
        box.innerText = "";
        box.disabled = false; 
    }

    // reset variables 
    movesCount = 0;
    playerO = true;

    resultDiv.classList.add("hidden");  // result div disappears 
    resetCurrentPlayerText(); 
}

restartBtn.addEventListener("click", restartGame);
newGameBtn.addEventListener("click", restartGame);


const checkWinner = () => {
    for (let idx of winStates) {
        let first = boxes[idx[0]].innerText;
        let second = boxes[idx[1]].innerText;
        let third = boxes[idx[2]].innerText;

        if (first != "" && second != "" && third != "" &&
            first == second && second == third) {
            
            displayResult(first);   // first = winner symbol 
            endGame();
            return;
        }
    }

    if (movesCount == 9) {  // game tied  
        displayResult(null);    // null = no winner 
        endGame(); 
    }
};

const displayResult = (winner) => {
    resultDiv.classList.remove("hidden");   // show result div 
    
    if(winner) {
        resultMsg.innerText = `winner is player ${winner}`; 
    } else {
        resultMsg.innerText = "match is tied";
    }

}; 

const endGame = () => {
    boxes.forEach((box) => {
        box.disabled = true;
    }); 

    currentPlayer.innerText = ""; 
}; 

// main game logic 
boxes.forEach((box) => {
    box.addEventListener("click", () => {
        if (playerO) {
            box.innerText = "O";
            playerO = false;
        } else {
            box.innerText = "X";
            playerO = true;
        }

        box.disabled = true;
        movesCount += 1; 

        resetCurrentPlayerText(); 
        if(movesCount >= 5) {   // minimum 5 moves required to win a match 
            checkWinner(); 
        }
    });
}); 

