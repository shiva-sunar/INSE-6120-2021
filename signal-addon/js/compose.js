var tabId;

async function load() {
    // The user clicked our button, get the active tab in the current window using
    // the tabs API.
    let tabs = await messenger.tabs.query({active: true, currentWindow: true});
    tabId = tabs[0].id;

    let compose = await messenger.compose.getComposeDetails(tabs[0].id);
    document.getElementById("receiverEmailAddress").textContent = compose.to;
    document.getElementById("emailSubject").textContent = compose.subject;
    document.getElementById("emailBody").innerText = compose.body;

    showCompose();
}

document.addEventListener("DOMContentLoaded", load);

function phoneValidate(phone) {
    var regexPattern=new RegExp(/^[0-9-+]+$/);    // regular expression pattern
    return regexPattern.test(phone);
}

function showMessage(type, message) {
    removeMessage();
    if (type) {
        $("#successfulBox").removeClass("d-none");
        $("#successfulMessage").text(message);
    } else {
        $("#warningBox").removeClass("d-none");
        $("#warningMessage").text(message);
    }

    setInterval(function () {
        removeMessage()
    }, 5000);
}

function removeMessage() {
    $("#successfulBox").addClass("d-none");
    $("#warningBox").addClass("d-none");
    $("#successfulMessage").text("");
    $("#warningMessage").text("");
}

function loginToSignal(phoneNumber) {
    $.ajax({
        url: "http://signal.api:5000/api/v1/resources/linkUser",
        type: "GET",
        data: {
            phoneNumber: phoneNumber,
        },
        complete: function (data) {
            console.log(data);
        }
    });
}

function getRandomString(length) {
    var randomChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    var result = '';
    for ( var i = 0; i < length; i++ ) {
        result += randomChars.charAt(Math.floor(Math.random() * randomChars.length));
    }
    return result;
}

function sendMessageWithSignal(phoneNumber) {
    var password = $("#signalKey").val();
    var receiverPhoneNumber = $("#contactList").val();

    if (password !== "" && receiverPhoneNumber !== "") {
        var randomID = (Math.floor((Math.random() * 2000000) + 1000000)) + "" + Date.now();
        $.ajax({
            url: "http://signal.api:5000/api/v1/resources/sendMessage",
            type: "GET",
            data: {
                sentDate: new Date(Date.now()),
                senderPhone: phoneNumber,
                receiverPhone: receiverPhoneNumber,
                password: password,
                hash: randomID,
            },

            success: function (data) {
                showMessage(true, "Message sent successfully" + data.text());
            },
            error: function (data) {
                showMessage(true, "Sending message Failed!" + data.text());
            }
        });
        var encryptedBody = $("#emailBodyCiphertext").val();
        randomID = "h/##" + randomID + "##/h";
        var bodyText = "###SignalEncrypted### <br>" + "ID: <br>" + randomID + " <br> Email Content: <br>" + encryptedBody;
        messenger.compose.setComposeDetails(tabId, {body: bodyText});
        messenger.compose.sendMessage(tabId, {mode: "sendNow"});
    }else {
        showMessage(false, "Receiver phone number and password fields are mandatory!");
    }
}

$("#sendEmail").click(function () {
    sendMessageWithSignal($("#senderVerifiedPhoneNumber").text());
});

$("#loginToSignalButton").click(function () {
    var senderPhoneNumber = $("#senderPhoneNumber").val();
    if (phoneValidate(senderPhoneNumber)) {
        // showMessage(true, "OK!");
        loginToSignal($("#senderPhoneNumber").val());
    }else {
        showMessage(false, "Invalid phone number.");
    }
});

function syncContactList(phoneNumber) {
    if (!$("#SendMessageForm").hasClass("d-none")) {
        $.ajax({
            url: "http://signal.api:5000/api/v1/resources/contacts/all",
            type: "GET",
            data: {
                phoneNumber: phoneNumber,
            },
            success: function (data) {
                $.each(data.recipients, function (i, item) {
                    if (item.contact.name !== "") {
                        $("#contactList").append($('<option>',{
                            value: item.number,
                            text: item.contact.name
                        }));
                    }
                });
            }
        });
    }
}

$("#updateContactList").click(function () {
    var phoneNumber = $("#senderVerifiedPhoneNumber").text();
    if (!$("#SendMessageForm").hasClass("d-none")) {
        $.ajax({
            url: "http://signal.api:5000/api/v1/resources/contacts/update",
            type: "GET",
            data: {
                phoneNumber: phoneNumber,
            },
            beforeSend: function () {
                showMessage(true, "Contact list update request sent successfully.");
            },
            success: function (data) {
                $("#contactList").empty().append("<option>None</option>");
                syncContactList(data.phoneNumber);
                showMessage(true, "Contact list updated successfully!");
            }
        });
    }
});

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
            $("#sendMessageForm").addClass("d-none");
            $("#linkForm").removeClass("d-none");
        }
    });
});

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

function encryptEmail() {
    // Encrypt
    var password = getRandomString(20);
    $("#signalKey").val(password);
    var ciphertext = "e/##" + CryptoJS.AES.encrypt($("#emailBody").text(), password) + "##/e";

    $("#emailBodyCiphertext").html(ciphertext.toString());
}

function showCompose() {
    $.ajax({
        url: "http://signal.api:5000/api/v1/resources/getRegisteredPhoneNumber",
        type: "GET",
        success: function (data) {
            if (data.phoneNumber != "") {
                $("#sendMessageForm").removeClass("d-none");
                $("#senderVerifiedPhoneNumber").html(data.phoneNumber);
                syncContactList(data.phoneNumber);
                encryptEmail()
            } else {
                $("#linkForm").removeClass("d-none");
            }
        },
        error: function (data) {
            showMessage(false, "Something went wrong!");
        }
    });
}