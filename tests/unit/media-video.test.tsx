import {render,screen} from "@testing-library/react";
import {expect,it,vi} from "vitest";
import {MediaVideo} from "@/components/ui/media-video";
import {apiConfig} from "@/services/api/config";
vi.mock("@/services/api/config",()=>({apiConfig:{baseUrl:"http://localhost:8000/api/v1"}}));

it("uses the API session for private managed video",()=>{
  render(<MediaVideo data-testid="video" src={`${apiConfig.baseUrl}/media/00000000-0000-4000-8000-000000000001/download`}/>);
  expect(screen.getByTestId("video")).toHaveAttribute("crossorigin","use-credentials");
});
it("does not send API credentials to an external lookalike media path",()=>{
  render(<MediaVideo data-testid="video" src="https://external.example/api/v1/media/00000000-0000-4000-8000-000000000001/download"/>);
  expect(screen.getByTestId("video")).not.toHaveAttribute("crossorigin");
});
