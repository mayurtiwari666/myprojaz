const awsConfig = {
    Auth: {
        Cognito: {
            userPoolId: 'us-east-1_VT82bTVEX',
            userPoolClientId: '2mhovll3csgcqmg8uj6le5ffhd',
            loginWith: {
                email: true,
            }
        }
    }
};

export default awsConfig;
