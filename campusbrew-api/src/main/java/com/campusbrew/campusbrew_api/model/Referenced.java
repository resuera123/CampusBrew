package com.campusbrew.campusbrew_api.model;

/**
 * A document the admin refers to by a short, readable number such as RPT-0007.
 * ReferenceNumberListener assigns it on the first save.
 */
public interface Referenced {

    String getRef();

    void setRef(String ref);

    /** The letters before the number, e.g. "RPT". */
    String refPrefix();
}
