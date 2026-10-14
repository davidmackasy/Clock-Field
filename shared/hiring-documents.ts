export const identificationOptions = [
  {type:'government_id',label:'Driver’s licence / government ID'},
  {type:'passport',label:'Passport'},
  {type:'work_permit',label:'Work permit / work authorization'},
  {type:'provincial_id',label:'Provincial / state ID'},
  {type:'permanent_residency',label:'Permanent resident card / residency document'},
  {type:'other_id',label:'Other identification'},
];
export const identificationTypes = identificationOptions.map(option=>option.type);
