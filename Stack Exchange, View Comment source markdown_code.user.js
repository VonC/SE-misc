// ==UserScript==
// @name        Stack Exchange, View Comment source markdown/code
// @description Adds buttons to each comment to copy that comment's markdown to the clipboard.
// @match       *://*.askubuntu.com/*
// @match       *://*.onstartups.com/*
// @match       *://*.serverfault.com/*
// @match       *://*.stackapps.com/*
// @match       *://*.stackexchange.com/*
// @match       *://*.stackoverflow.com/*
// @match       *://*.superuser.com/*
// @exclude     *://api.stackexchange.com/*
// @exclude     *://area51.stackexchange.com/*
// @exclude     *://blog.*.com/*
// @exclude     *://chat.*.com/*
// @exclude     *://data.stackexchange.com/*
// @exclude     *://openid.stackexchange.com/*
// @exclude     *://stackexchange.com/*
// @noframes
// @require     https://ajax.googleapis.com/ajax/libs/jquery/2.1.0/jquery.min.js
// @require     https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant       GM_addStyle
// @grant       GM_setClipboard
// @version     1.1.1
// @history     1.1.1 Updated to fetch commentId from data-follow-up-id or id attribute
// @history     1.1 Added auto resizing and control to textarea. Slight tweaks.
// @history     1.0 Initial write.
// ==/UserScript==
/* global $, waitForKeyElements, StackExchange */
const seApiBaseUrl = "https://api.stackexchange.com/2.3/";
const tm_msgOptions = { position: { at: "top center", my: "bottom center" }, type: 'info', transient: false };
var   gbl_LastCmmntId = 0;

// Insert "Code" button into each comment body
waitForKeyElements(".comment-body, .js-follow-up .js-comment-body", addMarkdownBttn);
function addMarkdownBttn(jNode) {
    jNode.append(`<button class="tmCCodeBtn s-btn s-btn__link" aria-label="Code"><span class="hover-only-label">Code</span></button>`);
}

// Handle click on "Code" button
$("#content").on("click", ".tmCCodeBtn", zEvent => {
    const $btn = $(zEvent.currentTarget);

    //-- **UPDATED: broader selector to find the comment container**
    const commentNd = $btn.closest(".comment, .js-follow-up, [id^='comment-']");

    //-- **UPDATED: extract commentId from data-follow-up-id or id**
    let commentId = commentNd.attr("data-follow-up-id")
                 || commentNd.data("commentId");
    if (!commentId) {
        const m = commentNd.attr("id")?.match(/^comment-(\d+)$/);
        commentId = m ? m[1] : null;
    }

    if (!commentId) {
        console.error("Unable to determine commentId", commentNd);
        return;
    }

    StackExchange.helpers.showMessage(
        zEvent.currentTarget,
        `<textarea class="tmCmmntCode" id="tmCmmntCode-${commentId}">Fetching data...</textarea>
         <br><button class="tmCopyCmmntCode">to Clipboard</button>`,
        tm_msgOptions
    );

    $(`#tmCmmntCode-${commentId}`).click(stopClickFromClosing);
    $(".tmCopyCmmntCode").click(clipboardizeComment);

    fetchCommentMarkdown(commentId);
});

function stopClickFromClosing(zEvent) {
    zEvent.preventDefault();
    zEvent.stopPropagation();
}

function clipboardizeComment(zEvent) {
    const txtArea = $(zEvent.target).prevAll(".tmCmmntCode");
    GM_setClipboard(txtArea.val(), 'text');
}

function fetchCommentMarkdown(commentId) {
    gbl_LastCmmntId = commentId;
    const reqURL = `${seApiBaseUrl}comments/${commentId}`
                 + "?filter=*J74u4MrvgeNSF_WvbUk"
                 + "&key=5CtZ)DaSoSCUwmIDR*c09Q(("
                 + `&site=${location.host}`;
    $.getJSON(reqURL, processCommentBody).fail((jqXHR, textStatus) => {
        reportError("API error: " + textStatus, "Detail: " + jqXHR.responseText);
    });
}

function processCommentBody(jsonRsp) {
    checkForRoutineAPI_Errors(jsonRsp);
    let cmmntMarkDown = "Comment not found! (Likely API error)";
    let commentId = gbl_LastCmmntId;

    if (jsonRsp.items && jsonRsp.items.length) {
        cmmntMarkDown = jsonRsp.items[0].body_markdown || "API bug: Markdown not returned";
        commentId = jsonRsp.items[0].comment_id || gbl_LastCmmntId;
    }

    const textAreaJNd = $(`#tmCmmntCode-${commentId}`);
    textAreaJNd.val(cmmntMarkDown);
    // auto-resize
    const cntnrJNd = textAreaJNd.closest(".message");
    const oldTop = cntnrJNd.offset().top;
    const oldH = cntnrJNd.outerHeight();
    const ta = textAreaJNd[0];
    if (ta.scrollHeight > textAreaJNd.innerHeight()) {
        ta.style.height = (ta.scrollHeight + 3) + "px";
        cntnrJNd.offset({ top: oldTop - cntnrJNd.outerHeight() + oldH });
    }
}

function checkForRoutineAPI_Errors(jsonRsp) {
    if (jsonRsp.backoff) {
        reportError(`API sent backoff warning, ${jsonRsp.backoff} seconds.`); }
    if (jsonRsp.quota_remaining < 20) {
        reportError(`API low quota alert. ${jsonRsp.quota_remaining} remaining.`); }
    if (jsonRsp.error_id) {
        reportError(`Error ${jsonRsp.error_id}, ${jsonRsp.error_name}.`, jsonRsp.error_message); }
}

GM_addStyle(`
    .tmCCodeBtn { margin-left: 1ex; }
    .tmCmmntCode { min-width: 35em; min-height: 6em; resize: both; }
`);

function reportError(errLine1, errLine2) {
    console.error("SE VCM script: ", errLine1, errLine2 || "");
    if (window.StackExchange?.notify?.show) {
        StackExchange.notify.show(
            `Error in SE VCM script.<br>${errLine1}${errLine2 ? "<br>"+errLine2 : ""}`,
            13137713
        );
    } else {
        alert(`Error in SE VCM script.\n${errLine1}\n${errLine2 || ""}`);
    }
}
