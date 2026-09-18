"""Compatibility shim for Comfy Kitchen with the server's Torch 2.4 runtime.

Newer Comfy Kitchen releases use built-in generic annotations such as
``list[int]`` in custom-op signatures. Torch 2.4 understands the equivalent
``typing.List[int]`` form, but rejects the built-in generic at schema
inference time. Normalize only the annotations passed to schema inference;
the operator implementations and model files are unchanged.
"""

from __future__ import annotations

import types
import typing


def _normalize(annotation):
    if annotation is type(None):
        # Torch 2.4 represents a ``-> None`` annotation as NoneType after
        # get_type_hints(), while its schema parser expects the literal None.
        return None

    origin = typing.get_origin(annotation)
    args = typing.get_args(annotation)

    if origin is list and len(args) == 1:
        return typing.List[_normalize(args[0])]
    if origin is tuple and args:
        return typing.Tuple[tuple(_normalize(arg) for arg in args)]
    if origin in (types.UnionType, typing.Union):
        return typing.Union[tuple(_normalize(arg) for arg in args)]
    return annotation


try:
    import torch._custom_op.impl as _custom_op_impl

    _original_infer_schema = _custom_op_impl.infer_schema

    def _compat_infer_schema(function, mutates_args=()):
        annotations = getattr(function, "__annotations__", None)
        if not annotations:
            return _original_infer_schema(function, mutates_args)

        original = dict(annotations)
        try:
            resolved = typing.get_type_hints(function)
        except Exception:
            resolved = original
        annotations.update({name: _normalize(value) for name, value in resolved.items()})
        try:
            return _original_infer_schema(function, mutates_args)
        finally:
            annotations.clear()
            annotations.update(original)

    _custom_op_impl.infer_schema = _compat_infer_schema
except Exception:
    # If Torch changes its internal import layout, let ComfyUI report the
    # native error rather than making startup fail inside this shim.
    pass
