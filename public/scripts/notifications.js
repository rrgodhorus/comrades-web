"use strict";
//ESLINT rules 
/*global Snackbar toastr firebase*/


var GREEN = "#0f9d58";
var BLUE = "#4285f4";
var RED = "#db443";

var FileList = [];

var notificationData = {
    title: null,
    message: null,
    imageUrl: "",
    username: null
};

function clearNewNotification() {
    $("#input-notification-title").val("");
    $("#input-notification-message").val("");
    $("#img-preview").attr("src", "");
    imageFile = null;
    notificationData.title = null;
    notificationData.message = null;
    notificationData.imageUrl = "";
    notificationData.username = null;
}

function resetAlerts() {
    $("#alert-image-selected").show();
    $("#alert-image-not-selected").show();
}

function selectImage() {

    var inputFile = $("<input type='file'>").click(function() {

        $(this).one("change", function(event) {
            //Get file
            var file = event.target.files[0];
            if (file.type.search("image/") === 0) {
                var img = $('<img />', {
                    id: 'img-preview',
                    src: URL.createObjectURL(file),
                    alt: 'MyAlt',
                    class: 'img-fluid z-depth-1 hoverable',
                });
                img.appendTo($('#imgs-up'));
                FileList.push(file);
                toastr.success('Image added to Queue: ' + file.name);
            } else {
                if (file.type.search("application/pdf") === 0) {
                    FileList.push(file);
                    toastr.success('PDF file added to Queue: ' + file.name);
                } else {
                    toastr.error("Error : File not an image");
                    console.log(file.type);
                }
            }

        });
    });
    inputFile.click();

}

function verifyNotif() {

    let isVerified = true;

    if (!$("#input-notification-title").val()) {
        toastr.error("Title required");
        isVerified = false;
    }
    if (!$("#input-notification-message").val()) {
        toastr.error("Notification message required");
        isVerified = false;
    }

    return isVerified;
}

function insertNotificationToDatabase() {

    const ADMIN_FEED_PATH_DEBUG = "/debug/adminFeed";
    const ADMIN_FEED_PATH_RELEASE = "/release/adminFeed";
    var dbRefDebug = firebase.database().ref(ADMIN_FEED_PATH_DEBUG);
    // var dbRefRelease = firebase.database().ref(ADMIN_FEED_PATH_RELEASE);

    var notificationKey = dbRefDebug.push().key;

    function setNotifResponse(result) {

        if (result) {
            toastr.error(result.message);
            $("#spinner-upload").css("color", RED);
            $("#spinner-upload").hide();
        } else {

            $("#modal-confirm").modal("hide");
            clearNewNotification();
            $("#spinner-upload").css("color", RED);
            $("#spinner-upload").hide();
            Snackbar.show({
                text: "Notification sent",
                pos: "top-right"
            });

        }
    };

    dbRefDebug.child(notificationKey).set(notificationData, setNotifResponse);
    // dbRefRelease.child(notificationKey).set(notificationData,setNotifResponse);

}

function setNotifDataAndUpload() {

    $("#spinner-upload").show();
    notificationData.title = $("#input-notification-title").val();
    notificationData.message = $("#input-notification-message").val();
    var userEmail = firebase.auth().currentUser.email;
    notificationData.username = userEmail.substring(0, userEmail.indexOf("@"));
    for (var i = FileList.length - 1; i >= 0; i--) {
        File = FileList[i];
        console.log('Uploading ' + i + ' File');
        if (File) {

            //Upload the image/file
            var storageRef = firebase.storage().ref("adminFeed-" +
                File.type.split('/')[0] +
                "/" +
                File.name +
                Date.now());
            var uploadTask = storageRef.put(File);
            $("#spinner-upload").css("color", BLUE);
            uploadTask.on("state_changed",
                function progress(snapshot) {

                },
                function error(error) {
                    toastr.error(error.message);
                    $("#spinner-upload").css("color", RED);
                    $("#spinner-upload").hide();
                },
                function complete(argument) {

                    /**New image uploaded**/
                    $("#spinner-upload").css("color", GREEN);
                    //Get download url
                    storageRef.getDownloadURL().then(function(url) {
                        if(File.type.search('image/')===0)
                            notificationData.imageUrl = url;
                        insertNotificationToDatabase();
                    });
                }
            );
        } else {
            notificationData.imageUrl = "";
            insertNotificationToDatabase();
        }
    }
}

function sendNotification() {

    if (!verifyNotif()) {
        return;
    }
    if (!imageFile) {
        $("#alert-image-selected").hide();
    } else {
        $("#alert-image-not-selected").hide();
    }
    $("#modal-confirm").modal("show");
}

$(function() {

    $("#btn-upload-image").click(selectImage);

    $("#btn-send").click(sendNotification);

    $("#modal-confirm").on("hidden.bs.modal", resetAlerts);

    $("#btn-send-confirm").click(setNotifDataAndUpload);

});
