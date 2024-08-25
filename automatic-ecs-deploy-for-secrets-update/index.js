const AWS = require('aws-sdk');
const ecs = new AWS.ECS({ apiVersion: '2014-11-13' });
const codedeploy= new AWS.CodeDeploy({ apiVersion: '2014-10-06' });

var parameters;
var task;
var ecsServiceParameters;
var revisionStaticPart1 = `version: 0.0
Resources:
  - TargetService:
      Type: AWS::ECS::Service
      Properties:
        TaskDefinition: `;

exports.handler = async function(event, context) {
 if ('aws.secretsmanager' === event.source) {        
        await handleSecretsManagerChange(event.detail);
    }
else {
    return;
}    
};

const handleSecretsManagerChange = async detail => {
    if (detail.errorCode && typeof detail.errorCode === 'string') {
        //  This is a failure event - we can ignore
        return;
    }

    if ('PutSecretValue' === detail.eventName) {
        const secretId = detail.requestParameters.secretId;
        
        if (secretId.includes("${secrets_manager_name}")) {
            // ${secrets_manager_name} have been updated -
            // restart service that references ${secrets_manager_name}" in its task definition
            updateEcsServiceParameters(process.env.ECS_Service,process.env.ECS_Cluster);        
            await describeEcsService(ecsServiceParameters);
            deployParameters(process.env.ECS_Application,process.env.ECS_DeploymentGroup,process.env.ECS_Service_Container,process.env.ECS_Service_Port);            
            await updateCodedeploy(parameters);
        }
        else if (secretId.includes("${another_secrets_manager_name}")) {
            // ${another_secrets_manager_name} secrets have been updated -
            // restart service that references ${secrets_manager_name}" in its task definition
            updateEcsServiceParameters(process.env.another_ECS_Service,process.env.ECS_Cluster);        
            await describeEcsService(ecsServiceParameters);
            deployParameters(process.env.another_ECS_Application,process.env.another_ECS_DeploymentGroup,process.env.another_ECS_Service_Container,process.env.another_ECS_Service_Port);            
            await updateCodedeploy(parameters);
               
        }
        
    
    }
};

const updateCodedeploy = async function(params) {
    try {
        await codedeploy.createDeployment(params).promise();
    } catch (error) {
        console.log(`codedeploy.updateCodedeploy failed. Reason: ${error}`);
    }
};
const describeEcsService = async function(params) {
    try {
        await ecs.describeServices(params, function(err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else     {console.log(data.services[0].taskDefinition);
       task= data.services[0].taskDefinition;
  }           // successful response
}).promise();
    } catch (error) {
        console.log(`ecs.describeServices failed. Reason: ${error}`);
    }
};
const updateEcsServiceParameters = function (service,cluster){
    // ECS_Service secrets have been updated -
// restart containers for the ECS_Cluster cluster
            ecsServiceParameters ={
                                    services: [ /* required */
                                    service   /* more items */
                                     ],
                                    cluster: cluster,
                                 };
            };
 const deployParameters = function(application,deploymentgroup,containername,containerport){
                 parameters = {
  applicationName: application, 
  deploymentGroupName: deploymentgroup,
  deploymentConfigName: "CodeDeployDefault.ECSAllAtOnce",
  revision: {
       revisionType: "AppSpecContent",
       appSpecContent: {
      content: revisionStaticPart1 + task + `\n`+
`        LoadBalancerInfo:
         ContainerName: ` + containername + `\n`+ 
`         ContainerPort: ` + containerport + `\n`+
`        PlatformVersion: "1.4.0"`
    }
  }
 };
     
 };
 
 