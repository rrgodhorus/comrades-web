"use strict";
//ESLINT rules 
/*global Snackbar toastr firebase*/

// idx tracks the number of calls for upload and helps in creating new progressbar each time
var idx = 0;

var GREEN = "#0f9d58";
var BLUE = "#4285f4";
var RED = "#db443";

/* 
 * fileRefs : list of the uploaded files as dict with 
 *         name, downloadURL and fullPath in storage
 * responses: list of their responses received
 */
var fileRefs = []
var responses = []


const ADMIN_FEED_PATH_DEBUG = "/debug/adminFeed";
const ADMIN_FEED_PATH_RELEASE = "/release/adminFeed";
var dbRefDebug = firebase.database().ref(ADMIN_FEED_PATH_DEBUG);
// var dbRefRelease = firebase.database().ref(ADMIN_FEED_PATH_RELEASE);
const ADMIN_STORAGE_PATH_DEBUG = "/debug/adminStorage";
const ADMIN_STORAGE_PATH_RELEASE = "/release/adminStorage";
var storageRefDebug = firebase.storage().ref(ADMIN_STORAGE_PATH_DEBUG);
// var storageRefRelease = firebase.storage().ref(ADMIN_STORAGE_PATH_RELEASE);

function clearNewNotification() {
    $("#input-notification-title").val("");
    $("#input-notification-message").val("");
    $(".progress").remove();
    fileRefs = []
    responses = []
}

function resetAlerts() {
    $("#alert-image-selected").show();
    $("#alert-image-not-selected").show();
}


function uploadFile(file, storageRef){
    return new Promise(function(resolve, reject){
            /* New Upload initiated */
            idx = idx + 1;

            /* Create a new upload task for the specific file */
            var fileRef = storageRef.child(file.name);
            var uploadTask = fileRef.put(file);
            
            /* Create a new mdBootstrap progress Bar that updates with flow */
            var progress = 0;
            $('<div class="progress"><div class="progress-bar progress-bar-striped progress-bar-'+ idx +'" role="progressbar" aria-valuemin="0" aria-valuemax="100"></div></div>').appendTo('.fileuploads');
            var progressBar = $('.progress-bar-'+idx);

            /* Make changes as the state of task changes with upload */
            uploadTask.on(firebase.storage.TaskEvent.STATE_CHANGED,
                function(snapshot){
                    /* Get task progress and change the progressBar accordingly */
                    progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    progressBar.attr('aria-valuenow', progress);
                    progressBar.css('width', progress + '%');
                    progressBar.html(file.name + ': ' + Math.floor(progress).toString() + '%');
                },
                function(err) {
                    progressBar.removeClass('progress-bar-striped');
                    progressBar.html(file.name + ' upload unsucessfull')
                    progressBar.tooltip({ 
                        title: err, 
                        container: ".progress", 
                        placement: "right"
                    });
                    console.log("ERROR: (Index)", idx, err);
                    reject(err);
                },
                function() {
                    uploadTask.snapshot.ref.getDownloadURL().then(function(downloadURL) {
                        /* Change progressBar text and bg + give tooltip */
                        progressBar.removeClass('progress-bar-striped');
                        progressBar.html("Completed:", file.name);
                        fileRef.getMetadata().then(function(meta){
                            /* Image Tooltip if the uploaded file is image */
                            if(meta['contentType'].includes('image/'))
                                progressBar.tooltip({ 
                                    title: '<img style="width:160px;height:160px;" src="' + downloadURL + '" />', 
                                    html: true, 
                                    container: ".progress", 
                                    placement: "right"
                                });
                            else
                                progressBar.tooltip({ 
                                    title: 'File Uploaded', 
                                    container: ".progress", 
                                    placement: "right"
                                });
                        });
                        Snackbar.show({
                            text: file.name + " Uploaded",
                            pos: "top-right"
                        });
                        
                    });
                    resolve(fileRef);
                }
            );
        });
}


function selectFile() {
    /*
     * This function allows multiple selection of files and makes 
     * async calls to UploadFile(). It resolves as a file reference
     */
    var inputFile = $("<input type='file' multiple>").click(function() {
        $(this).one("change", function(event) { 
            for (var i = 0, f; f = event.target.files[i]; i++) {
                 var File = event.target.files[i];

                 // var response = uploadFile(File, storageRefRelease).then(function(fileRef){
                 var response = uploadFile(File, storageRefDebug).then(function(fileRef){
                    fileRef.getMetadata().then(function(meta){
                        fileRef.getDownloadURL().then(function(downloadURL){
                            fileRefs.push({
                                name : meta['name'],
                                downloadURL : downloadURL,
                                fullPath: meta['fullPath']
                            });
                        }); 
                    });
                 });
                 responses.push(response)
            }
            Promise.all(responses.map(promise => promise.catch(e => e)))
                            .then(result => console.log(result.length))
                            .catch(e => console.log(e));
        });
    });
    inputFile.click();

}

function verifyNotif() {
    /* Verifies the required fields are filled */
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

function sendToDB(msgTitle, username, msgText, fileRefs) {
    var d = new Date();
    var notificationData = {
        title: msgTitle,
        username: username,
        text: msgText,
        files: fileRefs,
        fileExist: true,
        timestamp: d.toUTCString()
    };
    if (fileRefs === undefined || fileRefs.length == 0) {
        notificationData['fileExist'] = false;
    };

    var notificationKey = dbRefDebug.push().key;
    // var notificationKey = dbRefRelease.push().key;

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

function sendNotifData() {

    $("#spinner-upload").show();
    var title = $("#input-notification-title").val();
    var message = $("#input-notification-message").val();
    var userEmail = firebase.auth().currentUser.email;
    var username = userEmail.substring(0, userEmail.indexOf("@"));

    sendToDB(title, username, message, fileRefs);
}

function diplayModal() {
    /*
     * displays the Modal that confirms the user wants to upload the
     * files or not?
     */
    if (!verifyNotif()) {
        return;
    }
    if (!Array.isArray(fileRefs) || !fileRefs.length) {
        $("#alert-image-selected").hide();
    } else {
        $("#alert-image-not-selected").hide();
    }
    $("#modal-confirm").modal("show");
}

$(function() {

    $("#btn-upload-image").click(selectFile);

    $("#btn-send").click(diplayModal);

    $("#modal-confirm").on("hidden.bs.modal", resetAlerts);

    $("#btn-send-confirm").click(sendNotifData);

});
