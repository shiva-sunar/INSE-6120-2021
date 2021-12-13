var tabId;
var encryptedEmailBody;

async function load() {
    // The user clicked our button, get the active tab in the current window using
    // the tabs API.
    let tabs = await messenger.tabs.query({active: true, currentWindow: true});
    tabId = tabs[0].id;

    let messageDisplay = await messenger.messageDisplay.getDisplayedMessage(tabId);
    let message = await messenger.messages.getFull(messageDisplay.id);
    var messageBody;
    if (message.parts[0].body == null) {
        messageBody = message.parts[0].parts[0].body;
    }else {
        messageBody = message.parts[0].body;
    }
    if (isSupported(messageBody)) {
        document.getElementById("senderEmailAddress").textContent = messageDisplay.author;
        document.getElementById("emailSubject").textContent = messageDisplay.subject;
        encryptedEmailBody = messageBody;
        displayEmail();
    } else {
        notSupportedEmail();
    }
}

document.addEventListener("DOMContentLoaded", load);

function showMessage(type, message, timerOn = true) {
    removeMessage();
    if (type) {
        $("#successfulBox").removeClass("d-none");
        $("#successfulMessage").text(message);
    } else {
        $("#warningBox").removeClass("d-none");
        $("#warningMessage").text(message);
    }

    if (timerOn) {
        setInterval(function () {
            removeMessage()
        }, 5000);
    }
}

function removeMessage() {
    $("#successfulBox").addClass("d-none");
    $("#warningBox").addClass("d-none");
    $("#successfulMessage").text("");
    $("#warningMessage").text("");
}

function getEncryptedEmail(value) {
    var subStr = value.match("e/##(.*)##/e");
    return subStr[1];
}

function getIdOfPassword(value) {
    var subStr = String(value.match("h/##[0-9]{20}##/h"));
    var val2 = subStr.substring(4, subStr.length-4);
    return val2;
}

function isSupported(mailContent) {
    return mailContent.includes("###SignalEncrypted###");
}

function notSupportedEmail() {
    showMessage(false, "This email is not supported by Signal Add-On!", false);
}

$("#linkButton").click(function () {
    var deviceName = $("#deviceName").val();

    if (deviceName == "") {
        showMessage(false, "Please input a device name!");
    } else {
        $.ajax({
            url: "http://signal.api:5000/api/v1/resources/linkDevice",
            type: "GET",
            data: {
                deviceName: deviceName,
            },
            success: function (data) {
                showMessage(true, "Now you can link " + data.deviceName + " through terminal.");
            }
        });
    }
});

function decryptEmail() {
    $("#decryptedEmailBody").html("Decrypting Email...");
    findPassword();
}

$("#logout").click(function () {
    var phoneNumber = $("#senderVerifiedPhoneNumber").text();
    $.ajax({
        url: "http://signal.api:5000/api/v1/resources/logout",
        type: "GET",
        data: {
            phoneNumber: phoneNumber,
        },
        success: function (data) {
            showMessage(true, "You have logout successfully from " + data.phoneNumber);
            $("#displayEmail").addClass("d-none");
            $("#linkForm").removeClass("d-none");
        }
    });
});

function findPassword() {
    $.ajax({
        url: "http://signal.api:5000/api/v1/resources/getPasswordOfHash",
        type: "GET",
        data: {
            hash: getIdOfPassword(encryptedEmailBody),
        },
        success: function (data) {
            showMessage(true, "Password has been derived successfully!");

            var encryptedEmail = getEncryptedEmail(encryptedEmailBody);
            // Decrypt
            var bytes  = CryptoJS.AES.decrypt(encryptedEmail, data.password);
            var plaintext = bytes.toString(CryptoJS.enc.Utf8);
            $("#decryptedEmailBody").empty();
            $("#decryptedEmailBody").html(plaintext);
        },
        error: function (data) {
            showMessage(false, "Password has not been found!");
        }
    });
}

function displayEmail() {
    $.ajax({
        url: "http://signal.api:5000/api/v1/resources/getRegisteredPhoneNumber",
        type: "GET",
        success: function (data) {
            if (data.phoneNumber != "") {
                $("#displayEmail").removeClass("d-none");
                $("#senderVerifiedPhoneNumber").html(data.phoneNumber);
				decryptEmail();
            } else {
                showMessage(false, "Something went wrong!");
            }
        },
        error: function (data) {
            showMessage(false, data);
        }
    });
}