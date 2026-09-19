from dataclasses import asdict, dataclass

from app.governed_functions import domain_profile_for_system
from app.mcp.entities import MCPEntity
from app.mcp.patterns import matched_domain_terms, regex_profile, validate_text


@dataclass(frozen=True)
class RAGProfile:
    entity: MCPEntity
    system_id: int
    domain: str
    source_schema: str
    chunk_table: str
    max_top_k: int
    max_context_chars: int
    retrieval_focus: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        data = asdict(self)
        data["entity"] = self.entity.value
        return data


_ENTITY_LIMITS: dict[MCPEntity, tuple[int, int]] = {
    MCPEntity.ANALYST: (8, 24_000),
    MCPEntity.DATA_MODELER: (10, 30_000),
    MCPEntity.EVALUATOR: (12, 32_000),
    MCPEntity.ADVISOR: (8, 24_000),
}


def _focus(entity: MCPEntity, system_id: int) -> tuple[str, ...]:
    domain = domain_profile_for_system(system_id)
    if entity is MCPEntity.ANALYST:
        return domain.analytical_focus
    if entity is MCPEntity.DATA_MODELER:
        return domain.modeling_focus
    if entity is MCPEntity.EVALUATOR:
        return domain.evaluation_focus
    return domain.advisory_focus


def rag_profile(entity: MCPEntity, system_id: int) -> RAGProfile:
    domain = domain_profile_for_system(system_id)
    max_top_k, max_chars = _ENTITY_LIMITS[entity]
    return RAGProfile(
        entity=entity,
        system_id=system_id,
        domain=domain.domain,
        source_schema="source",
        chunk_table="rag_chunks",
        max_top_k=max_top_k,
        max_context_chars=max_chars,
        retrieval_focus=_focus(entity, system_id),
    )


def retrieval_pattern(entity: MCPEntity, system_id: int, query: str) -> dict[str, object]:
    validate_text(query)
    profile = rag_profile(entity, system_id)
    return {
        "profile": profile.to_dict(),
        "regex": regex_profile(system_id).to_dict(),
        "matched_domain_terms": matched_domain_terms(system_id, query),
        "retrieval_query": query.strip(),
    }
