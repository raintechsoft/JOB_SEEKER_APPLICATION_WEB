import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/primitives";

describe("floating-label fields", () => {
  it("renders the prototype's outlined field structure and tracks value", async () => {
    render(<TextField label="Email address" name="email" required placeholder="you@example.com" />);
    const input = screen.getByRole("textbox", { name: /email address/i });
    const wrap = input.parentElement!;
    expect(wrap).toHaveClass("floating-field", "is-required");
    expect(wrap).not.toHaveClass("has-value");
    expect(input).toHaveAttribute("placeholder", " ");
    expect(input).toHaveAttribute("aria-description", "you@example.com");
    await userEvent.type(input, "a@b.co");
    expect(wrap).toHaveClass("has-value");
  });
});

describe("primitives", () => {
  it("falls back to initials without a portrait", () => {
    render(<Avatar person={{ id: "p2", name: "Jordan Lee" }} />);
    expect(screen.getByLabelText("Jordan Lee")).toHaveTextContent("JL");
  });
  it("uses the shipped portrait for Alex Morgan", () => {
    render(<Avatar person={{ id: "p0", name: "Alex Morgan" }} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "/images/avatars/alex-morgan.svg");
  });
  it("renders icons as decorative SVG", () => {
    const { container } = render(<Icon name="bell" />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
