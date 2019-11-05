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
            let data = localStorage.getItem("app_data");

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
            localStorage.setItem("app_data", JSON.stringify(this.$data));
        },
        updateSignUpButton() {
            this.signup_button_href = `https://slack.com/oauth/authorize?scope=channels:history,groups:history,im:history,mpim:history,channels:read,im:read,users:read,channels:write,chat:write:user,im:write&client_id=${this.client_id}&redirect_uri=${window.location.origin}`;            
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
                        this.Log("Please click the 'Sign in with Slack' button, if you do not see the button then you need to fill in the client id field");
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
                historyEndPoint = `https://slack.com/api/conversations.history?token=${authAccess.access_token}&channel=${this.channel_id}&cursor=${cursor}`;
            }

            fetch(historyEndPoint).then(async(res) => {
                let conversationJson = await res.json();

                console.log(cursor, conversationJson);

                let messages = conversationJson.messages;

                let filteredMessages = messages.filter((item) => {
                    if (item.user == authAccess.user_id) {
                        return true;
                    }

                    return false;
                });

                this.Log(`Will delete ${filteredMessages.length} message(s) at cursor '${cursor}'`);

                if (filteredMessages.length > 0) {

                    filteredMessages.forEach((item, index) => {
                        let timeout = setTimeout(() => {
                            var deleteEndpoint = "https://slack.com/api/chat.delete?token=" + authAccess.access_token + "&channel=" + this.channel_id + "&ts=" + item.ts;
                            fetch(deleteEndpoint).then(async(res) => {
                                let deleteJson = await res.json();

                                this.messages_deleted_count = this.messages_deleted_count + 1;
                                // let date = new Date(Number(item.ts));

                                //Log(`Deleted message index: ${index} with time stamp:${date}`);
                            });

                            if (index >= filteredMessages.length - 1) {
                                this.moveToCursor(conversationJson.response_metadata);                                
                            }

                        }, index * 3 * 1000);
                    });
                } else {
                    this.moveToCursor(conversationJson.response_metadata);
                }
            });
        },
        moveToCursor(cursor){
            console.log("Moving to next cursor", cursor);
            if (cursor != undefined && cursor.next_cursor != undefined) {
                this.deleteMessages(cursor.next_cursor);
            } else {
                this.Log("End");
            }
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
            this.ClearLog();
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
        this.updateSignUpButton();
        this.updateStorage();
    }
});
