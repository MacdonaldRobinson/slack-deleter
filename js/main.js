var app = new Vue({
    el: "#app",
    data: {
        client_id: "",
        client_secret: "",
        channel_id: "",
        code: "",
        signup_button_href: '',
        auth_access: "",
        logs: [],
        messages_deleted_count: 0
    },
    methods: {
        initialize() {
            this.ClearLog();
            let data = sessionStorage.getItem("app_data");

            if (data != undefined && data != "") {
                let json = JSON.parse(data);
                Object.assign(this.$data, json);
            }

            let code = this.getQueryString("code");

            if (code != "" && code != undefined && code != null) {
                this.code = code;
            }

            this.updateSignUpButton();
            this.updateStorage();
            this.checkAuthAccess();
        },
        updateStorage() {
            sessionStorage.setItem("app_data", JSON.stringify(this.$data));
        },
        updateSignUpButton() {
            this.signup_button_href = `https://slack.com/oauth/authorize?scope=channels:history,groups:history,im:history,mpim:history,channels:read,im:read,users:read,channels:write,chat:write:user,im:write&redirect_uri=${window.location.href}&client_id=${this.client_id}`;
        },
        getAuthAccess() {
            return this.auth_access;
        },
        setAuthAccess(authAccess) {
            this.auth_access = authAccess;
        },
        checkAuthAccess(callbackFunction) {
            this.ClearLog();
            console.log("Ran checkAuthAccess");

            code = this.code;
            authAccess = this.getAuthAccess();

            console.log("code", code);

            if (authAccess == null || !authAccess.ok) {
                this.fetchAuthAccess(code, (authAccess) => {
                    console.log("Callback for fetchAuthAccess", authAccess);

                    this.setAuthAccess(authAccess);
                    if (typeof(callbackFunction) == 'function') {
                        callbackFunction();
                    }
                });
            }
        },
        fetchAuthAccess(code, callBackFunction) {
            let endPoint = `https://slack.com/api/oauth.access?client_id=${this.client_id}&client_secret=${this.client_secret}&code=${code}&scope=identity.basic,channels:history,groups:history,mpim:history,im:history`;

            fetch(endPoint)
                .then(async(res) => {

                    authAccess = await res.json();
                    console.log("Ran fetchAuthAccess then", authAccess);

                    if (authAccess.ok) {
                        callBackFunction(authAccess);
                    } else {
                        this.Log("Please relogin");
                    }
                });
        },
        deleteMessages(cursor) {
            console.log("Ran deleteMessages");

            let authAccess = this.getAuthAccess();

            if (!authAccess.ok) {
                this.Log("Please sign in to Slack");
                return;
            }

            let historyEndPoint = `https://slack.com/api/conversations.history?token=${authAccess.access_token}&channel=${this.channel_id}`;

            if (cursor != undefined && cursor != "") {
                historyEndPoint = `https://slack.com/api/conversations.history?token=${authAccess.access_token}&channel=D0P7Y3FU7&cursor=${cursor}`;
            }

            fetch(historyEndPoint).then(async(res) => {
                let conversationJson = await res.json();

                console.log(conversationJson);

                let messages = conversationJson.messages;

                let filteredMessages = messages.filter((item) => {
                    if (item.user == authAccess.user_id) {
                        return true;
                    }

                    return false;
                });

                this.Log(`Will delete ${filteredMessages.length} message(s) at cursor`);

                if (filteredMessages.length > 0) {

                    filteredMessages.forEach((item, index) => {
                        let timeout = setTimeout(() => {
                            console.log(item);

                            var deleteEndpoint = "https://slack.com/api/chat.delete?token=" + authAccess.access_token + "&channel=" + this.channel_id + "&ts=" + item.ts;
                            fetch(deleteEndpoint).then(async(res) => {
                                let deleteJson = await res.json();

                                this.messages_deleted_count = this.messages_deleted_count + 1;
                                // let date = new Date(Number(item.ts));

                                //Log(`Deleted message index: ${index} with time stamp:${date}`);
                            });

                            if (index >= filteredMessages.length - 1) {
                                this.Log("No more messages for the user in cursor " + cursor);
                                if (conversationJson.response_metadata != undefined) {
                                    console.log("Moving to next cursor", cursor);
                                    this.deleteMessages(cursor);
                                } else {
                                    this.Log("End");
                                }
                            }

                        }, index * 3 * 1000);
                    });
                } else {
                    this.Log("No more messages for the user in cursor", cursor);
                    if (conversationJson.response_metadata != undefined) {
                        console.log("Moving to next cursor", cursor);
                        this.deleteMessages(cursor);
                    } else {
                        this.Log("End");
                    }
                }
            });
        },
        getQueryString(param) {
            let paramPair = window.location.search.replace('?', '').split('&')

            let found = paramPair.reduce((pair) => {
                let split = pair.split(`${param}=`);

                if (split.length > 1) {
                    return split[1];
                }

                return "";
            });

            return found;
        },
        Run() {
            console.log("Ran Run");
            this.deleteMessages();
        },
        ClearLog() {
            this.logs = [];
        },
        Log(message) {
            this.logs.push(message);
        }
    },
    created: function() {
        this.initialize();
    },
    updated: function() {
        this.updateStorage();
    }
});