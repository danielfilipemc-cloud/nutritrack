"use client";
import {useParams} from "next/navigation";
import AssessmentWorkspace from "../../../components/AssessmentWorkspace";
export default function ClientProfile(){
 const {id}=useParams<{id:string}>();
 return <AssessmentWorkspace key={id} profileId={id}/>;
}
